// The default "ajv" export only ships the draft-07 meta-schema; Draft 2020-12
// (this schema's dialect — see ADR-014) needs the Ajv2020 build.
import Ajv2020 from "ajv/dist/2020.js";
import type { ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
// deno-lint-ignore no-import-assertions
// specs/ is currently owned by apps/m5-documents (the only consumer of this schema) rather
// than living at the repo root — if a second module ever needs its own Result Envelope
// spec, this is the seam to reconsider promoting to a shared location.
import resultEnvelopeSchema from "../../../apps/m5-documents/specs/result-envelope-v0.1-PROPOSED.json" with { type: "json" };
import type { AnchoredField, ValidatorContext } from "./validation/types.ts";
import { runValidators } from "./validation/index.ts";
import type { FieldResult, ResultEnvelope, ValidatorResult } from "./envelope-types.ts";

// `deno check` misresolves the CJS default-export interop for these two
// packages under Deno's npm-compat layer and reports "not constructable" /
// "not callable" — verified this is a type-checker-only false positive by
// running the exact same construction in `deno run` directly (a compiled
// validator that correctly passes/fails real data). Node/tsc and Vitest both
// type-check and execute this file with no issue (see envelope.test.ts).
// @ts-expect-error -- see comment above; safe, verified at runtime under Deno
const ajv = new Ajv2020({ allErrors: true, strict: false });
// @ts-expect-error -- same Deno npm-compat type-resolution quirk as above
addFormats(ajv);
const validate: ValidateFunction = ajv.compile(resultEnvelopeSchema);

function formatErrors(): string[] {
  return (validate.errors ?? []).map((e) => `${e.instancePath || "(root)"} ${e.message ?? ""}`.trim());
}

export function isValidEnvelope(candidate: unknown): candidate is ResultEnvelope {
  return Boolean(validate(candidate));
}

export function getEnvelopeSchemaErrors(candidate: unknown): string[] {
  validate(candidate);
  return formatErrors();
}

export function assertValidEnvelope(candidate: unknown): asserts candidate is ResultEnvelope {
  if (!validate(candidate)) {
    throw new Error(`Result Envelope failed schema validation: ${formatErrors().join("; ")}`);
  }
}

export interface BuildEnvelopeParams {
  documentId: string;
  sha256: string;
  detectedMime: string;
  partCount: number;
  languages: string[];
  profileId: string;
  profileVersion: string;
  profileStatus: ResultEnvelope["profile"]["status"];
  profileConfidence: number | null;
  /** Fields after evidence anchoring has run (see validation/anchor.ts). */
  anchoredFields: Record<string, AnchoredField>;
  requiredFieldPaths: string[];
  criticalFieldPaths: string[];
  validatorIds: string[];
  usage: ResultEnvelope["usage"];
  now?: Date;
}

export interface BuiltEnvelope {
  envelope: ResultEnvelope;
  /** Same field data, flattened — this is what gets written to the field_results table. */
  fieldRows: FieldResult[];
}

/**
 * Assemble a complete, schema-valid Result Envelope from anchored fields:
 * run the validator catalogue, attach results per field, force
 * requires_review under the pilot's mandatory-human-review policy, and
 * validate the whole thing against the JSON Schema before returning it.
 *
 * Throws if the assembled object doesn't satisfy its own schema — an
 * envelope that fails its own contract must never reach the database.
 */
export function buildEnvelope(params: BuildEnvelopeParams): BuiltEnvelope {
  const now = params.now ?? new Date();
  const ctx: ValidatorContext = {
    fields: params.anchoredFields,
    profileId: params.profileId,
    requiredFieldPaths: params.requiredFieldPaths,
    criticalFieldPaths: params.criticalFieldPaths,
    now,
  };

  const { byField, results, summary } = runValidators(ctx, params.validatorIds);

  const fields: Record<string, FieldResult> = {};
  for (const [path, field] of Object.entries(params.anchoredFields)) {
    const fieldValidators: ValidatorResult[] = byField[path] ?? [];
    fields[path] = {
      field_path: field.field_path,
      field_label: field.field_label,
      value: (field.value ?? null) as FieldResult["value"],
      status: field.status,
      // Mandatory 100% human review during the pilot (Charter §5 / Task
      // Protocol §7) — every field requires review regardless of confidence
      // or validator outcome. Validator/anchor state still drives export
      // blocking and review-queue prioritisation; it never suppresses review.
      requires_review: true,
      confidence: field.confidence,
      evidence: field.evidence,
      validators: fieldValidators,
      notes: null,
    };
  }

  const envelope: ResultEnvelope = {
    schema_version: "result-envelope-v0.1-PROPOSED",
    document: {
      id: params.documentId,
      sha256: params.sha256,
      detected_mime: params.detectedMime,
      part_count: params.partCount,
      languages: params.languages,
    },
    profile: {
      id: params.profileId,
      version: params.profileVersion,
      status: params.profileStatus,
      confidence: params.profileConfidence,
    },
    fields,
    validation: { results, summary },
    review: { state: "pending", policy: "mandatory_human_review" },
    usage: params.usage,
  };

  assertValidEnvelope(envelope);
  return { envelope, fieldRows: Object.values(fields) };
}
