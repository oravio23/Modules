import type Anthropic from "@anthropic-ai/sdk";
import { createMessage, EXTRACTION_MODEL } from "../anthropic.ts";
import type { DocumentProfileDefinition } from "../profiles/types.ts";

export interface ClassifyResult {
  profileId: string;
  confidence: number;
  reasoning: string;
  usage: Anthropic.Usage;
}

function buildClassifyTool(profiles: DocumentProfileDefinition[]): Anthropic.Tool {
  return {
    name: "record_classification",
    description: "Record which document profile best matches this document.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["profile_id", "confidence", "reasoning"],
      properties: {
        profile_id: { type: "string", enum: profiles.map((p) => p.id) },
        confidence: { type: "number", description: "0 to 1." },
        reasoning: { type: "string", description: "One sentence explaining the choice." },
      },
    },
  };
}

/**
 * Pick which profile applies — low effort, since this is a coarse
 * document-shape judgment, not a careful reading. The transcript excerpt is
 * capped to keep this call cheap; classification doesn't need the whole
 * document, just enough to recognise its shape.
 */
export async function classifyDocument(
  transcriptExcerpt: string,
  profiles: DocumentProfileDefinition[],
): Promise<ClassifyResult> {
  const profileSummaries = profiles
    .map((p) => `- id: "${p.id}" — ${p.title}. ${p.description}`)
    .join("\n");

  const response = await createMessage({
    model: EXTRACTION_MODEL,
    max_tokens: 1024,
    output_config: { effort: "low" },
    tools: [buildClassifyTool(profiles)],
    tool_choice: { type: "tool", name: "record_classification" },
    messages: [
      {
        role: "user",
        content: `Which of these document profiles best matches the document below?\n\n${profileSummaries}\n\nIf none of the specific profiles clearly fit, choose "generic" rather than forcing a mismatch.\n\n--- Document excerpt ---\n${transcriptExcerpt.slice(0, 6000)}`,
      },
    ],
  });

  const toolUse = response.content.find((b: Anthropic.ContentBlock): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  const input = toolUse?.input as { profile_id?: string; confidence?: number; reasoning?: string } | undefined;

  return {
    profileId: input?.profile_id ?? "generic",
    confidence: input?.confidence ?? 0,
    reasoning: input?.reasoning ?? "(no reasoning returned)",
    usage: response.usage,
  };
}
