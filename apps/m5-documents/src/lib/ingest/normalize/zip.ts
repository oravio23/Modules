import type { FileLike, NormalizeResult } from "../types.ts";
import { MAX_RECURSION_DEPTH, MAX_ZIP_ENTRIES } from "../types.ts";

export type RecurseFn = (file: FileLike, depth: number) => Promise<NormalizeResult>;

/** ZIP — recurse into every entry through the same ingest pipeline, flattening results. Depth- and entry-count-capped against zip bombs / pathological nesting. */
export async function normalizeZip(file: FileLike, depth: number, recurse: RecurseFn): Promise<NormalizeResult> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(file.bytes);

  const entries = Object.values(zip.files).filter((e) => !e.dir);
  const warnings: string[] = [];
  const parts: NormalizeResult["parts"] = [];

  if (depth >= MAX_RECURSION_DEPTH) {
    return { parts: [], warnings: [`${file.filename}: skipped — max recursion depth (${MAX_RECURSION_DEPTH}) reached`] };
  }

  const capped = entries.slice(0, MAX_ZIP_ENTRIES);
  if (entries.length > MAX_ZIP_ENTRIES) {
    warnings.push(`${file.filename}: ${entries.length - MAX_ZIP_ENTRIES} entries beyond the ${MAX_ZIP_ENTRIES}-entry cap were skipped`);
  }

  for (const entry of capped) {
    const bytes = await entry.async("uint8array");
    try {
      const sub = await recurse({ filename: entry.name, bytes }, depth + 1);
      for (const p of sub.parts) {
        parts.push({ ...p, label: `${file.filename} — ${entry.name} — ${p.label}` });
      }
      warnings.push(...sub.warnings);
    } catch (err) {
      warnings.push(`${file.filename}: entry "${entry.name}" could not be processed — ${(err as Error).message}`);
    }
  }

  return { parts, warnings };
}
