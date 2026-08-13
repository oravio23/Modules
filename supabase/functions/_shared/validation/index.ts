import type { ValidatorContext, ValidatorDefinition, ValidatorAttachment } from "./types.ts";
import type { ValidatorResult } from "../envelope-types.ts";
import { FORMAT_VALIDATORS } from "./format.ts";
import { ARITHMETIC_VALIDATORS } from "./arithmetic.ts";
import { CHECKSUM_VALIDATORS } from "./checksum.ts";
import { REFERENCE_VALIDATORS } from "./reference.ts";
import { CROSSFIELD_VALIDATORS } from "./crossfield.ts";
import { COMPLETENESS_VALIDATORS } from "./completeness.ts";
import { EVIDENCE_VALIDATORS } from "./evidence.ts";

export const ALL_VALIDATORS: ValidatorDefinition[] = [
  ...FORMAT_VALIDATORS,
  ...ARITHMETIC_VALIDATORS,
  ...CHECKSUM_VALIDATORS,
  ...REFERENCE_VALIDATORS,
  ...CROSSFIELD_VALIDATORS,
  ...COMPLETENESS_VALIDATORS,
  ...EVIDENCE_VALIDATORS,
];

export const VALIDATORS_BY_ID: Record<string, ValidatorDefinition> = Object.fromEntries(
  ALL_VALIDATORS.map((v) => [v.id, v]),
);

export interface RunValidatorsResult {
  /** field_path -> validator results to attach to that field. */
  byField: Record<string, ValidatorResult[]>;
  /** Flattened list for the envelope's top-level validation.results. */
  results: ValidatorResult[];
  summary: {
    pass: number;
    warn: number;
    fail: number;
    not_applicable: number;
    blocks_export: boolean;
  };
}

/**
 * Run every validator in the catalogue against a validator context, then
 * group the resulting attachments by field and compute the summary.
 *
 * A profile selects its own subset via `validatorIds` — validators for
 * fields the profile doesn't define (e.g. commercial-invoice arithmetic
 * checks running against a `generic` extraction) simply find nothing to
 * attach to and return no attachments, so passing the full catalogue here
 * is safe; `validatorIds` is what actually scopes which ones run.
 */
export function runValidators(ctx: ValidatorContext, validatorIds: string[]): RunValidatorsResult {
  const attachments: ValidatorAttachment[] = [];
  for (const id of validatorIds) {
    const def = VALIDATORS_BY_ID[id];
    if (!def) continue; // unknown validator id in a profile — fail open, not silently invented
    attachments.push(...def.run(ctx));
  }

  const byField: Record<string, ValidatorResult[]> = {};
  for (const a of attachments) {
    (byField[a.field_path] ??= []).push(a.result);
  }

  const results = attachments.map((a) => a.result);
  const summary = {
    pass: results.filter((r) => r.outcome === "pass").length,
    warn: results.filter((r) => r.outcome === "warn").length,
    fail: results.filter((r) => r.outcome === "fail").length,
    not_applicable: results.filter((r) => r.outcome === "not_applicable").length,
    blocks_export: results.some((r) => r.blocks_export),
  };

  return { byField, results, summary };
}

export * from "./types.ts";
export * from "./anchor.ts";
