import type { Evidence, FieldStatus, ValidatorResult } from "../envelope-types.ts";

/** One field's state as seen by validators — after evidence anchoring has run. */
export interface AnchoredField {
  field_path: string;
  field_label: string;
  value: unknown;
  status: FieldStatus;
  confidence: number | null;
  evidence: Evidence[];
}

export interface ValidatorContext {
  /** All fields in this extraction, keyed by field_path, anchoring already applied. */
  fields: Record<string, AnchoredField>;
  profileId: string;
  /** Field paths the profile marks required — feeds CMP-*. */
  requiredFieldPaths: string[];
  /** Field paths the profile marks critical — feeds EVD-* (unanchored critical field blocks export). */
  criticalFieldPaths: string[];
  /** Injectable clock for deterministic tests (XFD-001 "date not in the future"). */
  now: Date;
}

export interface ValidatorAttachment {
  /** Which field this result attaches to. */
  field_path: string;
  result: ValidatorResult;
}

export type ValidatorFn = (ctx: ValidatorContext) => ValidatorAttachment[];

export interface ValidatorDefinition {
  id: string;
  category: "FMT" | "ARI" | "CHK" | "REF" | "XFD" | "EVD" | "CMP";
  title: string;
  description: string;
  run: ValidatorFn;
}

/** Helper: build a single attachment with the common defaults filled in. */
export function attach(
  field_path: string,
  id: string,
  outcome: ValidatorResult["outcome"],
  opts: { message?: string | null; blocks_export?: boolean } = {},
): ValidatorAttachment {
  return {
    field_path,
    result: {
      id,
      outcome,
      message: opts.message ?? null,
      blocks_export: opts.blocks_export ?? false,
    },
  };
}
