// Hand-written to match supabase/migrations/0003_m5_documents.sql (repo root — this
// module's tables live in the shared platform database's m5 schema, not this app's own).
// Once `supabase` CLI access to a running project is available, regenerate with:
//   supabase gen types typescript --linked --schema m5 > src/integrations/supabase/types.ts
// and this file becomes machine-generated — keep the two in sync until then.

export type DocumentStatus = "uploaded" | "queued" | "processing" | "pending_review" | "reviewed" | "exported" | "failed";
export type PartKind = "page" | "sheet" | "slide" | "attachment" | "text";
export type JobStage = "register" | "transcribe" | "classify" | "extract" | "anchor" | "validate" | "done";
export type JobState = "queued" | "running" | "succeeded" | "failed";
export type FieldStatus = "extracted" | "missing" | "uncertain" | "conflicting" | "not_applicable";
export type ValidatorOutcome = "pass" | "warn" | "fail" | "not_applicable";
export type ReviewState = "pending" | "in_review" | "approved" | "rejected";
export type ProfileStatus = "PROPOSED" | "READY_FOR_REVIEW" | "APPROVED";

export interface DocumentRow {
  id: string;
  owner_id: string;
  org_id: string;
  filename: string;
  declared_mime: string | null;
  detected_mime: string | null;
  sha256: string;
  byte_size: number;
  storage_path: string;
  anthropic_file_id: string | null;
  status: DocumentStatus;
  profile_id: string | null;
  profile_confidence: number | null;
  language_hints: string[];
  error_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentPartRow {
  id: string;
  document_id: string;
  ordinal: number;
  kind: PartKind;
  label: string | null;
  storage_path: string | null;
  mime: string | null;
  width: number | null;
  height: number | null;
  anthropic_file_id: string | null;
  pending_text_layer: string | null;
  created_at: string;
}

export interface TranscriptRow {
  id: string;
  part_id: string;
  text: string;
  text_layer: string | null;
  direction: "ltr" | "rtl" | "auto";
  languages: string[];
  tables: unknown[];
  created_at: string;
}

export interface JobRow {
  id: string;
  document_id: string;
  stage: JobStage;
  state: JobState;
  attempts: number;
  max_attempts: number;
  progress_current: number;
  progress_total: number;
  last_error: string | null;
  run_after: string;
  created_at: string;
  updated_at: string;
}

export interface ProfileRow {
  id: string;
  version: string;
  status: ProfileStatus;
  title: string;
  description: string;
  schema: unknown;
  prompt: string;
  validator_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface ExtractionRow {
  id: string;
  document_id: string;
  profile_id: string;
  profile_version: string;
  envelope: unknown; // ResultEnvelope — see supabase/functions/_shared/envelope-types.ts
  usage_json: Record<string, number>;
  validation_summary: { pass: number; warn: number; fail: number; not_applicable: number; blocks_export: boolean };
  review_state: ReviewState;
  created_at: string;
  updated_at: string;
}

export interface FieldResultRow {
  id: string;
  extraction_id: string;
  field_path: string;
  field_label: string;
  value: unknown;
  status: FieldStatus;
  requires_review: boolean;
  confidence: number | null;
  evidence: Array<{ part_ordinal: number; quote: string; char_start: number | null; char_end: number | null; anchor: "verified" | "unverified" | "not_applicable" }>;
  validator_results: Array<{ id: string; outcome: ValidatorOutcome; message: string | null; blocks_export: boolean }>;
  notes: string | null;
  human_value: unknown;
  human_action: "accepted" | "edited" | "rejected" | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface AuditLogRow {
  id: string;
  document_id: string | null;
  extraction_id: string | null;
  actor_id: string | null;
  actor_kind: "human" | "system";
  action: string;
  detail: Record<string, unknown>;
  created_at: string;
}

export interface Database {
  m5: {
    Tables: {
      documents: { Row: DocumentRow; Insert: Partial<DocumentRow>; Update: Partial<DocumentRow> };
      document_parts: { Row: DocumentPartRow; Insert: Partial<DocumentPartRow>; Update: Partial<DocumentPartRow> };
      transcripts: { Row: TranscriptRow; Insert: Partial<TranscriptRow>; Update: Partial<TranscriptRow> };
      jobs: { Row: JobRow; Insert: Partial<JobRow>; Update: Partial<JobRow> };
      profiles: { Row: ProfileRow; Insert: Partial<ProfileRow>; Update: Partial<ProfileRow> };
      extractions: { Row: ExtractionRow; Insert: Partial<ExtractionRow>; Update: Partial<ExtractionRow> };
      field_results: { Row: FieldResultRow; Insert: Partial<FieldResultRow>; Update: Partial<FieldResultRow> };
      audit_log: { Row: AuditLogRow; Insert: Partial<AuditLogRow>; Update: Partial<AuditLogRow> };
    };
  };
}
