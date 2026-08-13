import type { PartKind } from "../parts.ts";
import type { JobStage } from "../pipeline/stages.ts";

/**
 * Wire contract for POST /documents-register. Portable (no Deno/browser
 * APIs) so the frontend and the edge function share one definition of the
 * request/response shape instead of two hand-kept-in-sync copies.
 */
export interface RegisterPartInput {
  ordinal: number;
  kind: PartKind;
  label: string;
  /** Authoritative transcript text, for sheet/slide/text kinds only (client-extracted — SheetJS/mammoth/fast-xml-parser). Ignored for 'page'. */
  text?: string;
  /** pdf.js cross-check text layer, for 'page' kind only. Stashed until the transcribe stage writes the real transcript. */
  textLayer?: string;
  /** Set only for binary parts already uploaded by the client to the 'documents' Storage bucket (standalone images, binary email/zip attachments). */
  storagePath?: string;
  mime?: string;
  width?: number;
  height?: number;
  direction?: "ltr" | "rtl" | "auto";
}

export interface RegisterDocumentRequest {
  filename: string;
  declaredMime?: string;
  detectedMime: string;
  sha256: string;
  byteSize: number;
  /** The original uploaded file, already stored by the client at this path in the 'documents' bucket. */
  storagePath: string;
  languageHints: string[];
  parts: RegisterPartInput[];
  warnings: string[];
}

export interface RegisterDocumentResponse {
  documentId: string;
  jobId: string;
  initialStage: JobStage;
  partCount: number;
}

export interface RegisterErrorResponse {
  error: string;
  reason?: string;
}
