import type Anthropic from "@anthropic-ai/sdk";
import { createBetaMessage, EXTRACTION_MODEL } from "../anthropic.ts";

export interface TranscribeTarget {
  partId: string;
  ordinal: number;
  /** True for a PDF page (shares the parent document's whole-file upload); false for a standalone image (its own upload). */
  isPdfPage: boolean;
  /** Anthropic file_id — the parent document's (for a PDF page) or this part's own (for a standalone image). */
  fileId: string;
  mime: string | null;
}

export interface TranscriptionResult {
  partId: string;
  ordinal: number;
  text: string;
}

const TRANSCRIBE_TOOL: Anthropic.Beta.Messages.BetaTool = {
  name: "record_transcriptions",
  description: "Record the verbatim transcription of each requested page or image.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["transcriptions"],
    properties: {
      transcriptions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["part_ordinal", "text"],
          properties: {
            part_ordinal: { type: "integer", description: "The part number this transcription is for, exactly as given in the instructions." },
            text: {
              type: "string",
              description:
                "Verbatim transcription of every visible character on this page/image, in reading order. Transcribe Arabic script as Arabic — never translate. Preserve numerals, punctuation, and line breaks as closely as plain text allows. If a region is illegible, write [illegible] in its place rather than guessing.",
            },
          },
        },
      },
    },
  },
};

/**
 * Transcribe one batch (up to ~4) of pages/images in a single Claude call.
 * All PDF pages in the batch share one `document` content block (the whole
 * PDF, referenced once); each standalone image gets its own `image` block.
 * This is the only stage that needs the model at all for these parts —
 * sheet/slide/text parts already had their transcript written at
 * registration time (see stages.ts).
 */
export async function transcribeBatch(targets: TranscribeTarget[]): Promise<{ results: TranscriptionResult[]; usage: Anthropic.Beta.Messages.BetaUsage }> {
  if (targets.length === 0) return { results: [], usage: { input_tokens: 0, output_tokens: 0 } as Anthropic.Beta.Messages.BetaUsage };

  const content: Anthropic.Beta.Messages.BetaContentBlockParam[] = [];
  const pdfTargets = targets.filter((t) => t.isPdfPage);
  if (pdfTargets.length > 0) {
    // All PDF-page targets in one batch come from the same parent document (the caller groups by document), so one file reference covers all of them.
    content.push({ type: "document", source: { type: "file", file_id: pdfTargets[0].fileId } });
  }
  for (const t of targets.filter((x) => !x.isPdfPage)) {
    content.push({ type: "image", source: { type: "file", file_id: t.fileId } });
  }

  const instructions = targets
    .map((t) => (t.isPdfPage ? `- Page ${t.ordinal} of the attached document.` : `- The attached image for part ${t.ordinal}.`))
    .join("\n");
  content.push({
    type: "text",
    text: `Transcribe the following, each as its own entry in the tool call:\n${instructions}\n\nCall record_transcriptions with one entry per item above, using its part_ordinal.`,
  });

  const response = await createBetaMessage({
    model: EXTRACTION_MODEL,
    max_tokens: 8000,
    output_config: { effort: "medium" },
    tools: [TRANSCRIBE_TOOL],
    tool_choice: { type: "tool", name: "record_transcriptions" },
    messages: [{ role: "user", content }],
  });

  const toolUse = response.content.find((b: Anthropic.Beta.Messages.BetaContentBlock): b is Anthropic.Beta.Messages.BetaToolUseBlock => b.type === "tool_use");
  const parsed = (toolUse?.input as { transcriptions?: { part_ordinal: number; text: string }[] } | undefined)?.transcriptions ?? [];

  const byOrdinal = new Map(targets.map((t) => [t.ordinal, t]));
  const results: TranscriptionResult[] = parsed
    .map((p) => {
      const target = byOrdinal.get(p.part_ordinal);
      return target ? { partId: target.partId, ordinal: target.ordinal, text: p.text } : null;
    })
    .filter((r): r is TranscriptionResult => r !== null);

  return { results, usage: response.usage };
}
