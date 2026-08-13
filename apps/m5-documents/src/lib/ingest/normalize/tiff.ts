import type { FileLike, NormalizedPart, NormalizeResult } from "../types.ts";
import { computeTargetSize } from "./image.ts";
import { toArrayBuffer } from "@/lib/bytes";

/** TIFF/BMP scans — decode each TIFF page (utif2, pure JS) to RGBA, rasterise via canvas, then resize/re-encode as JPEG. One part per page. BMP has no multi-page concept, so it's always exactly one part. Browser-only (canvas). */
export async function normalizeTiff(file: FileLike): Promise<NormalizeResult> {
  const UTIF = await import("utif2");
  const ifds = UTIF.decode(toArrayBuffer(file.bytes));

  const parts: NormalizedPart[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < ifds.length; i++) {
    const ifd = ifds[i];
    try {
      UTIF.decodeImage(toArrayBuffer(file.bytes), ifd);
      const rgba = UTIF.toRGBA8(ifd);
      const { width: w, height: h } = ifd;

      const source = document.createElement("canvas");
      source.width = w;
      source.height = h;
      const sctx = source.getContext("2d");
      if (!sctx) throw new Error("2D canvas context unavailable");
      sctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), w, h), 0, 0);

      const { width, height } = computeTargetSize(w, h);
      const out = document.createElement("canvas");
      out.width = width;
      out.height = height;
      const octx = out.getContext("2d");
      if (!octx) throw new Error("2D canvas context unavailable");
      octx.drawImage(source, 0, 0, width, height);

      const blob: Blob = await new Promise((resolve, reject) => {
        out.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas.toBlob returned null"))), "image/jpeg", 0.9);
      });
      const bytes = new Uint8Array(await blob.arrayBuffer());
      parts.push({ kind: "page", label: `Page ${i + 1}`, bytes, mime: "image/jpeg", width, height });
    } catch (err) {
      warnings.push(`${file.filename}: page ${i + 1} could not be decoded — ${(err as Error).message}`);
    }
  }

  if (parts.length === 0) {
    return { parts: [], warnings: [...warnings, `${file.filename}: no pages could be decoded`] };
  }
  return { parts, warnings };
}
