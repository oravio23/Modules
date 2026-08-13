import type { DetectedType, FileLike } from "./types.ts";

function bytesStartWith(bytes: Uint8Array, sig: number[], offset = 0): boolean {
  if (bytes.length < offset + sig.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (bytes[offset + i] !== sig[i]) return false;
  }
  return true;
}

function ascii(bytes: Uint8Array, start: number, len: number): string {
  return Array.from(bytes.slice(start, start + len))
    .map((b) => String.fromCharCode(b))
    .join("");
}

/** Peek inside a ZIP-based Office format's local file headers to tell docx/xlsx/pptx/plain-zip apart. */
function sniffZipFlavor(bytes: Uint8Array): "docx" | "xlsx" | "pptx" | "zip" {
  // Cheap heuristic: scan the raw bytes for the tell-tale part-name prefixes
  // that appear (uncompressed, literal ASCII) in every zip local file header
  // and again in the central directory. No decompression needed. Filenames
  // can appear anywhere in the archive depending on how many other parts
  // ([Content_Types].xml, _rels/.rels, docProps/*) were written first, so
  // scan generously rather than assuming they're near the front — capped
  // only as a safety bound against scanning a huge unrelated zip byte-by-byte.
  const text = ascii(bytes, 0, Math.min(bytes.length, 5_000_000));
  if (text.includes("word/document.xml")) return "docx";
  if (text.includes("xl/workbook.xml")) return "xlsx";
  if (text.includes("ppt/presentation.xml") || text.includes("ppt/slides/")) return "pptx";
  return "zip";
}

function looksLikeHeic(bytes: Uint8Array): boolean {
  // ISOBMFF: bytes[4..8) === "ftyp", brand at [8..12)
  if (bytes.length < 12) return false;
  if (ascii(bytes, 4, 4) !== "ftyp") return false;
  const brand = ascii(bytes, 8, 4);
  return ["heic", "heix", "hevc", "heim", "heis", "hevm", "hevs", "mif1", "msf1"].includes(brand);
}

function looksLikeEmailHeaders(text: string): boolean {
  const head = text.slice(0, 2000);
  const markers = [/^From:\s/im, /^Subject:\s/im, /^Received:\s/im, /^Delivered-To:\s/im, /^MIME-Version:\s/im, /^Return-Path:\s/im];
  return markers.filter((re) => re.test(head)).length >= 2;
}

function tryDecodeUtf8Strict(bytes: Uint8Array): string | null {
  try {
    // fatal:true rejects invalid UTF-8 instead of silently substituting U+FFFD,
    // so binary data we don't recognise is rejected rather than mangled into "text".
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

const EXTENSION_FALLBACKS: Record<string, DetectedType> = {
  ".md": { kind: "text/markdown", method: "extension", mime: "text/markdown" },
  ".markdown": { kind: "text/markdown", method: "extension", mime: "text/markdown" },
  ".csv": { kind: "text/csv", method: "extension", mime: "text/csv" },
  ".tsv": { kind: "text/csv", method: "extension", mime: "text/tab-separated-values" },
  ".json": { kind: "application/json", method: "extension", mime: "application/json" },
  ".xml": { kind: "text/xml", method: "extension", mime: "text/xml" },
  ".html": { kind: "text/html", method: "extension", mime: "text/html" },
  ".htm": { kind: "text/html", method: "extension", mime: "text/html" },
  ".rtf": { kind: "text/rtf", method: "extension", mime: "text/rtf" },
  ".txt": { kind: "text/plain", method: "extension", mime: "text/plain" },
  ".eml": { kind: "eml", method: "extension", mime: "message/rfc822" },
  ".msg": { kind: "msg", method: "extension", mime: "application/vnd.ms-outlook" },
};

/**
 * Detect a file's real type from its bytes first, filename extension last.
 * Never trusts a declared/extension mime on its own for anything with a
 * checkable binary signature — a renamed .exe with a .pdf extension is
 * still sniffed as whatever its magic bytes say (which, if truly unknown,
 * falls through to the UTF-8 text check and then outright rejection).
 */
export function detectType(file: FileLike): DetectedType {
  const { bytes, filename } = file;
  const ext = (filename.match(/\.[a-z0-9]+$/i)?.[0] ?? "").toLowerCase();

  if (bytesStartWith(bytes, [0x25, 0x50, 0x44, 0x46])) return { kind: "pdf", method: "magic", mime: "application/pdf" }; // %PDF
  if (bytesStartWith(bytes, [0xff, 0xd8, 0xff])) return { kind: "image/jpeg", method: "magic", mime: "image/jpeg" };
  if (bytesStartWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { kind: "image/png", method: "magic", mime: "image/png" };
  if (bytesStartWith(bytes, [0x47, 0x49, 0x46, 0x38])) return { kind: "image/gif", method: "magic", mime: "image/gif" }; // GIF8
  if (bytesStartWith(bytes, [0x42, 0x4d])) return { kind: "image/bmp", method: "magic", mime: "image/bmp" }; // BM
  if (bytesStartWith(bytes, [0x52, 0x49, 0x46, 0x46]) && ascii(bytes, 8, 4) === "WEBP") return { kind: "image/webp", method: "magic", mime: "image/webp" };
  if (bytesStartWith(bytes, [0x49, 0x49, 0x2a, 0x00]) || bytesStartWith(bytes, [0x4d, 0x4d, 0x00, 0x2a])) {
    return { kind: "image/tiff", method: "magic", mime: "image/tiff" };
  }
  if (looksLikeHeic(bytes)) return { kind: "image/heic", method: "magic", mime: "image/heic" };
  if (bytesStartWith(bytes, [0xd0, 0xcf, 0x11, 0xe0])) return { kind: "msg", method: "magic", mime: "application/vnd.ms-outlook" }; // OLE2/CFBF — legacy .doc/.xls/.msg
  if (bytesStartWith(bytes, [0x50, 0x4b, 0x03, 0x04]) || bytesStartWith(bytes, [0x50, 0x4b, 0x05, 0x06])) {
    const flavor = sniffZipFlavor(bytes);
    const mimeByFlavor: Record<string, string> = {
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      zip: "application/zip",
    };
    return { kind: flavor, method: "magic", mime: mimeByFlavor[flavor] };
  }

  // No binary signature matched — try UTF-8 text, then guess the flavor from content/extension.
  const text = tryDecodeUtf8Strict(bytes);
  if (text !== null) {
    if (looksLikeEmailHeaders(text)) return { kind: "eml", method: "heuristic", mime: "message/rfc822" };
    const byExt = EXTENSION_FALLBACKS[ext];
    if (byExt) return byExt;
    const trimmed = text.trimStart();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) return { kind: "application/json", method: "heuristic", mime: "application/json" };
    if (trimmed.startsWith("<")) return { kind: "text/xml", method: "heuristic", mime: "text/xml" };
    return { kind: "text/plain", method: "heuristic", mime: "text/plain" };
  }

  return { kind: "unknown", method: "extension", mime: file.declaredMime ?? "application/octet-stream" };
}
