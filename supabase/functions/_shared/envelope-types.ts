/**
 * TypeScript mirror of specs/result-envelope-v0.1-PROPOSED.json.
 *
 * Portable — no Deno/Node/browser-specific APIs — so it's importable from
 * edge functions, the frontend (via relative import), and vitest alike.
 * ajv validates actual data against the JSON Schema at runtime; these types
 * are the compile-time contract for code that builds or reads an envelope.
 *
 * Keep this file and the JSON Schema in sync by hand — there are few enough
 * fields that generating one from the other isn't worth the tooling.
 */

export type FieldStatus = "extracted" | "missing" | "uncertain" | "conflicting" | "not_applicable";

export type AnchorState = "verified" | "unverified" | "not_applicable";

export type ValidatorOutcome = "pass" | "warn" | "fail" | "not_applicable";

export type ProfileStatus = "PROPOSED" | "READY_FOR_REVIEW" | "APPROVED";

export type ReviewState = "pending" | "in_review" | "approved" | "rejected";

export interface Evidence {
  part_ordinal: number;
  quote: string;
  char_start: number | null;
  char_end: number | null;
  anchor: AnchorState;
}

/** Evidence as emitted by the model, before the anchoring gate has run. */
export type EvidenceDraft = Omit<Evidence, "anchor" | "char_start" | "char_end"> & {
  char_start?: number | null;
  char_end?: number | null;
};

export interface ValidatorResult {
  id: string;
  outcome: ValidatorOutcome;
  message: string | null;
  blocks_export: boolean;
}

export interface FieldResult {
  field_path: string;
  field_label: string;
  value: string | number | boolean | Record<string, unknown> | unknown[] | null;
  status: FieldStatus;
  requires_review: boolean;
  confidence: number | null;
  evidence: Evidence[];
  validators: ValidatorResult[];
  notes: string | null;
}

/** A field result as extracted by the model, before anchoring/validation. */
export interface FieldResultDraft {
  field_path: string;
  field_label: string;
  value: FieldResult["value"];
  status: FieldStatus;
  confidence: number | null;
  evidence: EvidenceDraft[];
  notes?: string | null;
}

export interface ValidationSummary {
  pass: number;
  warn: number;
  fail: number;
  not_applicable: number;
  blocks_export: boolean;
}

export interface ResultEnvelope {
  schema_version: "result-envelope-v0.1-PROPOSED";
  document: {
    id: string;
    sha256: string;
    detected_mime: string;
    part_count: number;
    languages: string[];
  };
  profile: {
    id: string;
    version: string;
    status: ProfileStatus;
    confidence: number | null;
  };
  fields: Record<string, FieldResult>;
  validation: {
    results: ValidatorResult[];
    summary: ValidationSummary;
  };
  review: {
    state: ReviewState;
    policy: "mandatory_human_review";
  };
  usage: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
    estimated_cost_usd?: number;
  };
}

/** A stored transcript for one document part — what the anchoring gate matches quotes against. */
export interface PartTranscript {
  part_ordinal: number;
  text: string;
  direction: "ltr" | "rtl" | "auto";
}
