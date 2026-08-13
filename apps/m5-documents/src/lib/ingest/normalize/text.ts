import type { FileLike, NormalizeResult } from "../types.ts";
import { suggestDirection } from "@/lib/arabic";

/** Plain text and text-shaped formats (txt/md/csv/tsv/json/xml/html/rtf) — decode and pass through as one part. */
export function normalizeText(file: FileLike): NormalizeResult {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(file.bytes);
  return {
    parts: [
      {
        kind: "text",
        label: file.filename,
        text,
        direction: suggestDirection(text),
      },
    ],
    warnings: [],
  };
}
