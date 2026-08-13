import { detectType } from "../sniff.ts";
import { IngestRejectedError, type FileLike, type NormalizeResult } from "../types.ts";
import { normalizeText } from "./text.ts";
import { normalizeXlsx } from "./xlsx.ts";
import { normalizeDocx } from "./docx.ts";
import { normalizePptx } from "./pptx.ts";
import { normalizeEml } from "./email.ts";
import { normalizeZip } from "./zip.ts";

/**
 * Sniff a file's real type from its bytes and dispatch to the matching
 * normaliser, producing a flat list of parts ready for the upload/transcribe
 * pipeline. Recognises type by content, not extension — see sniff.ts.
 *
 * Image/HEIC/TIFF normalisers are dynamically imported only when needed
 * (they pull in canvas-touching, browser-only code and, for HEIC, a WASM
 * decoder) — this keeps the initial bundle small, per the Lovable
 * compatibility contract (lazy-load per detected file type).
 */
export async function normalizeFileLike(file: FileLike, depth = 0): Promise<NormalizeResult> {
  const detected = detectType(file);

  switch (detected.kind) {
    case "text/plain":
    case "text/markdown":
    case "text/csv":
    case "application/json":
    case "text/xml":
    case "text/html":
    case "text/rtf":
      return normalizeText(file);

    case "xlsx":
      return normalizeXlsx(file);

    case "docx":
      return normalizeDocx(file);

    case "pptx":
      return normalizePptx(file);

    case "eml":
      return normalizeEml(file, depth, normalizeFileLike);

    case "zip":
      return normalizeZip(file, depth, normalizeFileLike);

    case "pdf": {
      const { normalizePdf } = await import("./pdf.ts");
      return normalizePdf(file);
    }

    case "image/jpeg":
    case "image/png":
    case "image/webp":
    case "image/gif":
    case "image/bmp": {
      const { normalizeImage } = await import("./image.ts");
      return normalizeImage(file);
    }

    case "image/tiff": {
      const { normalizeTiff } = await import("./tiff.ts");
      return normalizeTiff(file);
    }

    case "image/heic": {
      const { normalizeHeic } = await import("./heic.ts");
      return normalizeHeic(file);
    }

    case "msg":
      throw new IngestRejectedError(
        `"${file.filename}" is an Outlook .msg file, which this app doesn't parse yet. Export it as .eml (Outlook: File > Save As > Outlook Message Format - Unicode won't work; use "More Save As Options" and choose a mail-export add-in, or drag the message into a folder in a client that exports .eml) and re-upload.`,
        "unsupported_msg_format",
      );

    case "unknown":
    default:
      throw new IngestRejectedError(
        `"${file.filename}" isn't a recognised text or document format and couldn't be decoded as text either — it looks like binary data this app doesn't support.`,
        "unrecognized_binary",
      );
  }
}

/** Browser entry point: read a DOM File into bytes and run it through the same pipeline used for recursion. */
export async function normalizeFile(file: File): Promise<NormalizeResult> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return normalizeFileLike({ filename: file.name, bytes, declaredMime: file.type || undefined });
}

export { detectType } from "../sniff.ts";
export * from "../types.ts";
