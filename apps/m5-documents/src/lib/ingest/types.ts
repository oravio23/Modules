export type DetectedKind =
  | "pdf"
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/gif"
  | "image/bmp"
  | "image/tiff"
  | "image/heic"
  | "docx"
  | "xlsx"
  | "pptx"
  | "zip"
  | "eml"
  | "msg"
  | "text/plain"
  | "text/markdown"
  | "text/csv"
  | "application/json"
  | "text/xml"
  | "text/html"
  | "text/rtf"
  | "unknown";

export interface DetectedType {
  kind: DetectedKind;
  /** How confident the sniffer is — 'magic' (byte signature matched) beats 'heuristic' (content-shape guess) beats 'extension' (filename only, no content evidence). */
  method: "magic" | "heuristic" | "extension";
  mime: string;
}

/** A file's raw content, independent of any DOM File/Blob API — the same shape a browser upload, a zip entry, or an email attachment all normalise to. */
export interface FileLike {
  filename: string;
  bytes: Uint8Array;
  declaredMime?: string;
}

export type { PartKind } from "../_shared-vendor/parts.ts";
import type { PartKind } from "../_shared-vendor/parts.ts";

export interface NormalizedPart {
  kind: PartKind;
  label: string;
  /** Extracted text content, when this part's content IS text (sheet/slide/text kinds, or a PDF page's text layer as a cross-check). */
  text?: string;
  /**
   * This part's own binary content, ONLY when it needs its own upload
   * separate from the parent document's original file — a standalone image,
   * or a binary attachment recursed out of an email/zip. A native PDF's
   * pages do NOT set this: the whole PDF is uploaded once, referenced by
   * `documents.anthropic_file_id`, not per page.
   */
  bytes?: Uint8Array;
  mime?: string;
  width?: number;
  height?: number;
  direction?: "ltr" | "rtl" | "auto";
}

export interface NormalizeResult {
  parts: NormalizedPart[];
  warnings: string[];
  /** Set only for PDFs — lets the pipeline know how many pages to transcribe without re-parsing. */
  pdfPageCount?: number;
}

export class IngestRejectedError extends Error {
  constructor(
    message: string,
    public readonly reason: string,
  ) {
    super(message);
    this.name = "IngestRejectedError";
  }
}

/** Cap on recursion for zip/email attachment handling — prevents zip bombs and pathological nesting. */
export const MAX_RECURSION_DEPTH = 4;
export const MAX_ZIP_ENTRIES = 200;
