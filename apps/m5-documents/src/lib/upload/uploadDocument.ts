import { supabase } from "@/integrations/supabase/client";
import { detectType } from "@/lib/ingest/sniff";
import { normalizeFileLike, IngestRejectedError } from "@/lib/ingest/normalize/index";
import { sha256Hex } from "@/lib/hash";
import { getCurrentOrgId } from "@/lib/org";
import type { RegisterDocumentRequest, RegisterDocumentResponse } from "../../../../../supabase/functions/_shared/contracts/register.ts";

export type UploadPhase =
  | "reading"
  | "detecting"
  | "normalizing"
  | "uploading_original"
  | "uploading_parts"
  | "registering"
  | "done";

export interface UploadResult extends RegisterDocumentResponse {
  warnings: string[];
}

/**
 * The full client-side half of the pipeline: sniff -> normalise -> upload
 * original + any binary parts to Storage -> register with the edge
 * function, which takes it from there (Anthropic Files API upload, job
 * creation, kicking off pipeline-worker). Throws IngestRejectedError for a
 * file type this app doesn't support, with a reason a user can act on.
 */
export async function uploadDocument(file: File, onProgress?: (phase: UploadPhase) => void): Promise<UploadResult> {
  onProgress?.("reading");
  const bytes = new Uint8Array(await file.arrayBuffer());

  onProgress?.("detecting");
  const detected = detectType({ filename: file.name, bytes });
  if (detected.kind === "unknown") {
    throw new IngestRejectedError(
      `"${file.name}" isn't a recognised text or document format and couldn't be decoded as text either.`,
      "unrecognized_binary",
    );
  }

  const [sha256, normalized] = await Promise.all([
    sha256Hex(bytes),
    (async () => {
      onProgress?.("normalizing");
      return normalizeFileLike({ filename: file.name, bytes, declaredMime: file.type || undefined });
    })(),
  ]);

  // Storage paths are org-scoped, not user-scoped — the bucket policy checks
  // (storage.foldername(name))[1] against the caller's org membership, matching how the
  // documents table itself is now RLS-scoped by org_id rather than owner_id alone.
  const orgId = await getCurrentOrgId();

  const uploadId = crypto.randomUUID();
  const basePath = `${orgId}/${uploadId}`;
  const ext = file.name.match(/\.[a-z0-9]+$/i)?.[0] ?? "";

  onProgress?.("uploading_original");
  const originalPath = `${basePath}/original${ext}`;
  const { error: originalUploadError } = await supabase.storage
    .from("documents")
    .upload(originalPath, bytes, { contentType: detected.mime, upsert: false });
  if (originalUploadError) throw originalUploadError;

  onProgress?.("uploading_parts");
  const parts: RegisterDocumentRequest["parts"] = [];
  for (let i = 0; i < normalized.parts.length; i++) {
    const part = normalized.parts[i];
    const ordinal = i + 1;
    let storagePath: string | undefined;
    if (part.bytes) {
      storagePath = `${basePath}/part-${ordinal}`;
      const { error } = await supabase.storage
        .from("documents")
        .upload(storagePath, part.bytes, { contentType: part.mime ?? "application/octet-stream", upsert: false });
      if (error) throw error;
    }
    parts.push({
      ordinal,
      kind: part.kind,
      label: part.label,
      text: part.kind !== "page" ? part.text : undefined,
      textLayer: part.kind === "page" ? part.text : undefined,
      storagePath,
      mime: part.mime,
      width: part.width,
      height: part.height,
      direction: part.direction,
    });
  }

  onProgress?.("registering");
  const requestBody: RegisterDocumentRequest = {
    filename: file.name,
    declaredMime: file.type || undefined,
    detectedMime: detected.mime,
    sha256,
    byteSize: bytes.length,
    storagePath: originalPath,
    languageHints: [],
    parts,
    warnings: normalized.warnings,
  };

  const { data, error } = await supabase.functions.invoke<RegisterDocumentResponse>("documents-register", {
    body: requestBody,
  });
  if (error) throw error;
  if (!data) throw new Error("documents-register returned no data");

  onProgress?.("done");
  return { ...data, warnings: normalized.warnings };
}
