import type Anthropic from "@anthropic-ai/sdk";
import { createMessage, EXTRACTION_MODEL } from "../anthropic.ts";
import type { DocumentProfileDefinition } from "../profiles/types.ts";
import type { FieldResultDraft } from "../envelope-types.ts";

/**
 * One shared tool schema for every profile — the profile-specific field
 * catalogue lives in the PROMPT (see renderFieldCatalogue below), not in the
 * tool's input_schema, since a profile's repeating-group row count isn't
 * known ahead of time and strict JSON Schema can't express "however many
 * line items are actually on the document". See specs/profiles/*.json's
 * generated note for the same point.
 */
const EXTRACTION_TOOL: Anthropic.Tool = {
  name: "record_extraction",
  description: "Record every extracted field, each with its status and supporting evidence.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["fields"],
    properties: {
      fields: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["field_path", "field_label", "value", "status", "confidence", "evidence"],
          properties: {
            field_path: { type: "string", description: "Exactly one of the field paths named in the catalogue, with {i} replaced by the real 0-based row index for repeating fields." },
            field_label: { type: "string" },
            value: {
              anyOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }, { type: "null" }],
              description: "A scalar value. If the true value is structured (a table row, a nested group), encode it as a JSON string.",
            },
            status: { type: "string", enum: ["extracted", "missing", "uncertain", "conflicting", "not_applicable"] },
            confidence: { anyOf: [{ type: "number" }, { type: "null" }] },
            evidence: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["part_ordinal", "quote"],
                properties: {
                  part_ordinal: { type: "integer" },
                  quote: { type: "string", description: "VERBATIM substring copied from that part's transcript — not paraphrased." },
                },
              },
            },
            notes: { anyOf: [{ type: "string" }, { type: "null" }] },
          },
        },
      },
    },
  },
};

function renderFieldCatalogue(profile: DocumentProfileDefinition): string {
  const lines = profile.fields.map(
    (f) => `- ${f.path} (${f.type}${f.required ? ", required" : ""}${f.critical ? ", critical" : ""}): ${f.description}`,
  );
  if (profile.repeatingGroup) {
    lines.push(`\nFor each row in "${profile.repeatingGroup.groupPath}" (replace {i} with 0, 1, 2, ... for however many rows actually exist — zero rows is valid):`);
    for (const f of profile.repeatingGroup.fields) {
      lines.push(`- ${f.path} (${f.type}${f.required ? ", required" : ""}${f.critical ? ", critical" : ""}): ${f.description}`);
    }
  }
  return lines.join("\n");
}

export interface ExtractResult {
  fields: Record<string, FieldResultDraft>;
  usage: Anthropic.Usage;
}

export async function extractFields(
  profile: DocumentProfileDefinition,
  transcriptText: string,
): Promise<ExtractResult> {
  const effort = profile.id === "commercial_invoice" ? "xhigh" : "high";

  const response = await createMessage({
    model: EXTRACTION_MODEL,
    max_tokens: 16000,
    output_config: { effort },
    tools: [EXTRACTION_TOOL],
    tool_choice: { type: "tool", name: "record_extraction" },
    system: profile.extractionPrompt,
    messages: [
      {
        role: "user",
        content: `Field catalogue:\n${renderFieldCatalogue(profile)}\n\n--- Document transcript ---\n${transcriptText}`,
      },
    ],
  });

  const toolUse = response.content.find((b: Anthropic.ContentBlock): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  const rawFields = (toolUse?.input as { fields?: FieldResultDraft[] } | undefined)?.fields ?? [];

  const fields: Record<string, FieldResultDraft> = {};
  for (const f of rawFields) {
    fields[f.field_path] = f;
  }

  return { fields, usage: response.usage };
}
