import Anthropic, { toFile } from "@anthropic-ai/sdk";
import type { ResultEnvelope } from "./envelope-types.ts";

export const EXTRACTION_MODEL = "claude-opus-5";

let cachedClient: Anthropic | null = null;

/**
 * Reads an env var under either runtime this module gets loaded into:
 * Deno (edge functions, `Deno.env`) or Node (scripts/eval.ts via tsx,
 * `process.env`) — the eval harness imports this same pipeline code
 * directly rather than duplicating it, so this file can't assume Deno.
 */
function getEnvVar(name: string): string | undefined {
  if (typeof Deno !== "undefined") return Deno.env.get(name);
  if (typeof process !== "undefined") return process.env[name];
  return undefined;
}

/** Lazily-constructed client — `ANTHROPIC_API_KEY` lives only in Supabase function secrets (Deno.env) or the eval harness's own environment, never in src/ or a VITE_ var. */
export function getAnthropicClient(): Anthropic {
  if (!cachedClient) {
    const apiKey = getEnvVar("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set in this environment.");
    cachedClient = new Anthropic({ apiKey });
  }
  return cachedClient;
}

/** Upload a document/image once via the Files API; every downstream call references it by file_id instead of re-sending bytes. */
export async function uploadFileToAnthropic(bytes: Uint8Array, filename: string, mimeType: string): Promise<string> {
  const client = getAnthropicClient();
  const file = await client.beta.files.upload({
    file: await toFile(bytes, filename, { type: mimeType }),
    betas: ["files-api-2025-04-14"],
  });
  return file.id;
}

/**
 * Pricing per SKILL.md's cached model table — $5/$25 per MTok on Opus 5,
 * cache reads at ~0.1x input, 5-minute-TTL cache writes at ~1.25x input.
 * Re-check platform.claude.com/docs/en/pricing before trusting this for a
 * real budget report — these are the rates in effect at the time this file
 * was written, not a live lookup.
 */
const OPUS5_INPUT_PER_MTOK = 5;
const OPUS5_OUTPUT_PER_MTOK = 25;

export function computeCostUsd(usage: ResultEnvelope["usage"]): number {
  const input = (usage.input_tokens ?? 0) * (OPUS5_INPUT_PER_MTOK / 1_000_000);
  const output = (usage.output_tokens ?? 0) * (OPUS5_OUTPUT_PER_MTOK / 1_000_000);
  const cacheRead = (usage.cache_read_input_tokens ?? 0) * ((OPUS5_INPUT_PER_MTOK * 0.1) / 1_000_000);
  const cacheWrite = (usage.cache_creation_input_tokens ?? 0) * ((OPUS5_INPUT_PER_MTOK * 1.25) / 1_000_000);
  return Math.round((input + output + cacheRead + cacheWrite) * 1_000_000) / 1_000_000;
}

export interface UsageTotals {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
}

export function emptyUsageTotals(): UsageTotals {
  return { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
}

/** Accepts the SDK's raw `Usage` shape too, where cache fields are typed `number | null` rather than `number | undefined`. */
export function addUsage(totals: UsageTotals, usage: Partial<Record<keyof UsageTotals, number | null | undefined>> | undefined): UsageTotals {
  if (!usage) return totals;
  return {
    input_tokens: totals.input_tokens + (usage.input_tokens ?? 0),
    output_tokens: totals.output_tokens + (usage.output_tokens ?? 0),
    cache_read_input_tokens: totals.cache_read_input_tokens + (usage.cache_read_input_tokens ?? 0),
    cache_creation_input_tokens: totals.cache_creation_input_tokens + (usage.cache_creation_input_tokens ?? 0),
  };
}

export class AnthropicRefusalError extends Error {
  constructor(
    public readonly category: string | null,
    public readonly explanation: string | null,
  ) {
    super(`Claude declined this request${category ? ` (category: ${category})` : ""}${explanation ? `: ${explanation}` : ""}`);
    this.name = "AnthropicRefusalError";
  }
}

function checkRefusal(response: { stop_reason: string | null; stop_details?: { category?: string | null; explanation?: string | null } | null }): void {
  if (response.stop_reason === "refusal") {
    throw new AnthropicRefusalError(response.stop_details?.category ?? null, response.stop_details?.explanation ?? null);
  }
}

/**
 * Thin wrapper around messages.create that checks `stop_reason` before the
 * caller ever touches `content` — a refusal is a normal HTTP 200 with an
 * empty or partial content array, and reading content[0] unconditionally on
 * a refusal is exactly the bug SKILL.md warns about. Non-streaming only —
 * every call in this pipeline is a single bounded tool-use turn, well under
 * the ~16K-output threshold where streaming becomes necessary.
 */
export async function createMessage(
  params: Anthropic.MessageCreateParamsNonStreaming,
): Promise<Anthropic.Message> {
  const client = getAnthropicClient();
  const response = await client.messages.create(params);
  checkRefusal(response);
  return response;
}

/**
 * Same as createMessage, but on the beta endpoint with the Files API beta
 * enabled — required whenever a content block references an uploaded file
 * by `file_id` (SKILL.md: "type": "file" sources need `client.beta.messages`,
 * not the plain endpoint).
 */
export async function createBetaMessage(
  params: Anthropic.Beta.Messages.MessageCreateParamsNonStreaming,
): Promise<Anthropic.Beta.Messages.BetaMessage> {
  const client = getAnthropicClient();
  const response = await client.beta.messages.create({
    ...params,
    betas: [...(params.betas ?? []), "files-api-2025-04-14"],
  });
  checkRefusal(response);
  return response;
}
