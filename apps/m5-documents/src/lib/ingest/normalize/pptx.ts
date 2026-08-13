import type { FileLike, NormalizedPart, NormalizeResult } from "../types.ts";
import { suggestDirection } from "@/lib/arabic";

/**
 * PPTX — read the zip directly with jszip + fast-xml-parser rather than a
 * full presentation library. Slides are ordered by filename (slide1.xml,
 * slide2.xml, ...) rather than by presentation.xml's relationship graph —
 * simpler, and robust to a presentation.xml that's missing or malformed
 * (the slide content is what matters for extraction, not authoring order
 * edge cases).
 */
export async function normalizePptx(file: FileLike): Promise<NormalizeResult> {
  const [{ default: JSZip }, { XMLParser }] = await Promise.all([import("jszip"), import("fast-xml-parser")]);
  const zip = await JSZip.loadAsync(file.bytes);
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)\.xml$/)![1]);
      const nb = Number(b.match(/slide(\d+)\.xml$/)![1]);
      return na - nb;
    });

  if (slideFiles.length === 0) {
    return { parts: [], warnings: [`${file.filename}: no slides found`] };
  }

  const parser = new XMLParser({ ignoreAttributes: true, textNodeName: "#text" });
  const parts: NormalizedPart[] = [];
  for (let i = 0; i < slideFiles.length; i++) {
    const xml = await zip.files[slideFiles[i]].async("string");
    const texts = extractTextRuns(parser.parse(xml));
    const text = texts.join("\n");
    parts.push({ kind: "slide", label: `Slide ${i + 1}`, text, direction: suggestDirection(text) });
  }
  return { parts, warnings: [] };
}

/** Walk a parsed slide XML tree collecting every `<a:t>` text-run value, in document order. */
function extractTextRuns(node: unknown, out: string[] = []): string[] {
  if (node === null || node === undefined) return out;
  if (typeof node === "string" || typeof node === "number") return out;
  if (Array.isArray(node)) {
    for (const item of node) extractTextRuns(item, out);
    return out;
  }
  if (typeof node === "object") {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === "a:t") {
        if (typeof value === "string") out.push(value);
        else if (typeof value === "object" && value !== null && "#text" in (value as object)) {
          out.push(String((value as Record<string, unknown>)["#text"]));
        }
        continue;
      }
      extractTextRuns(value, out);
    }
  }
  return out;
}
