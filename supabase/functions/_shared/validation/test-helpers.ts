import type { FieldStatus } from "../envelope-types.ts";
import type { AnchoredField, ValidatorAttachment, ValidatorContext } from "./types.ts";

/** Build one AnchoredField for tests without hand-writing the full evidence shape every time. */
export function field(
  path: string,
  value: unknown,
  opts: { status?: FieldStatus; verified?: boolean; confidence?: number | null } = {},
): AnchoredField {
  const status = opts.status ?? (value === null ? "missing" : "extracted");
  const verified = opts.verified ?? status === "extracted";
  return {
    field_path: path,
    field_label: path,
    value,
    status,
    confidence: opts.confidence ?? (status === "extracted" ? 0.9 : null),
    evidence:
      status === "extracted"
        ? [{ part_ordinal: 1, quote: String(value), char_start: 0, char_end: String(value).length, anchor: verified ? "verified" : "unverified" }]
        : [],
  };
}

/** Build a ValidatorContext from a set of AnchoredFields with sensible test defaults. */
export function context(
  fields: Record<string, AnchoredField>,
  opts: Partial<Pick<ValidatorContext, "requiredFieldPaths" | "criticalFieldPaths" | "now">> = {},
): ValidatorContext {
  return {
    fields,
    profileId: "test-profile",
    requiredFieldPaths: opts.requiredFieldPaths ?? [],
    criticalFieldPaths: opts.criticalFieldPaths ?? [],
    now: opts.now ?? new Date("2026-08-06T00:00:00Z"),
  };
}

/** Filter a list of validator attachments down to one validator ID, for asserting on its outcome(s). */
export function byId(attachments: ValidatorAttachment[], id: string): ValidatorAttachment[] {
  return attachments.filter((a) => a.result.id === id);
}
