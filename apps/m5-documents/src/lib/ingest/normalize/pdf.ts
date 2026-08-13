import type { FileLike, NormalizedPart, NormalizeResult } from "../types.ts";

const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";

/**
 * Resolve the right pdf.js entry point for the current environment. In the
 * browser we need the configured worker + font/cmap URLs (see
 * lib/pdf/pdfjs-setup.ts, shared with the review-pane viewer). Under
 * Node/Vitest there's no served /pdfjs/ path to fetch a worker from, so we
 * use pdf.js's own "legacy" Node-compatible build instead, which runs
 * inline without a worker — this is also exactly how scripts/ fixture
 * verification exercises it, so the same code path is tested both ways.
 */
async function getPdfDocument(data: Uint8Array) {
  if (isBrowser) {
    const { ensurePdfJsConfigured, PDF_CMAPS_URL, PDF_STANDARD_FONT_DATA_URL } = await import("@/lib/pdf/pdfjs-setup");
    const pdfjsLib = ensurePdfJsConfigured();
    return pdfjsLib.getDocument({ data, standardFontDataUrl: PDF_STANDARD_FONT_DATA_URL, cMapUrl: PDF_CMAPS_URL, cMapPacked: true }).promise;
  }
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  return pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalSupported: false }).promise;
}

/**
 * PDF (native or scanned) — passed to Claude as the whole original file
 * later in the pipeline (Files API, one upload, referenced by
 * `documents.anthropic_file_id`). Here we only need: page count, and — for
 * native PDFs — the embedded text layer as a cross-check transcript
 * (scanned PDFs simply yield an empty layer per page, which is expected;
 * the model does the real reading in the transcription stage).
 */
export async function normalizePdf(file: FileLike): Promise<NormalizeResult> {
  const data = new Uint8Array(file.bytes); // pdf.js detaches/transfers the buffer it's given
  const doc = await getPdfDocument(data);

  const parts: NormalizedPart[] = [];
  const warnings: string[] = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    try {
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent();
      const text = content.items.map((item) => ("str" in item ? item.str : "")).join(" ").trim();
      parts.push({ kind: "page", label: `Page ${pageNum}`, text: text.length > 0 ? text : undefined });
    } catch (err) {
      warnings.push(`${file.filename}: page ${pageNum} text layer could not be read — ${(err as Error).message}`);
      parts.push({ kind: "page", label: `Page ${pageNum}` });
    }
  }

  await doc.destroy();
  return { parts, warnings, pdfPageCount: doc.numPages };
}
