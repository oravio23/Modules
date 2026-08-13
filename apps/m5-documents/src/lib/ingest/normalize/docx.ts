import type { FileLike, NormalizeResult } from "../types.ts";
import { suggestDirection } from "@/lib/arabic";
import { toArrayBuffer } from "@/lib/bytes";

/** DOCX — mammoth extracts the body text (and inline styles we don't need); no natural page boundary, so one part for the whole document. */
export async function normalizeDocx(file: FileLike): Promise<NormalizeResult> {
  const mammoth = await import("mammoth");
  // Vite/webpack resolve mammoth's "browser" build, which reads `arrayBuffer`;
  // Node (this file under Vitest) resolves the main build, which reads
  // `buffer` (a Node Buffer) and doesn't understand `arrayBuffer` at all
  // ("Could not find file in options"). Detect which build we actually got.
  const options = typeof Buffer !== "undefined"
    ? { buffer: Buffer.from(file.bytes) }
    : { arrayBuffer: toArrayBuffer(file.bytes) };
  const result = await mammoth.extractRawText(options);
  const warnings = result.messages.filter((m) => m.type === "warning").map((m) => `${file.filename}: ${m.message}`);
  return {
    parts: [
      {
        kind: "text",
        label: file.filename,
        text: result.value,
        direction: suggestDirection(result.value),
      },
    ],
    warnings,
  };
}
