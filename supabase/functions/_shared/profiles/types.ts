import type { ProfileStatus } from "../envelope-types.ts";

export type FieldValueType = "string" | "number" | "boolean" | "date" | "array" | "object";

export interface ProfileFieldDefinition {
  /**
   * Field path template. For a repeating field (inside a line-item-style
   * group), use "{i}" as the index placeholder, e.g. "line_items[{i}].total".
   * expandFieldPaths() below substitutes the real index at extraction time —
   * the count of repeating entries is never fixed by the schema, since the
   * whole point of a "any file, any length" pipeline is not knowing in
   * advance how many rows a document has.
   */
  path: string;
  label: string;
  type: FieldValueType;
  required: boolean;
  /** Unanchored + critical => blocks export (see EVD-001). Unanchored + non-critical => warn only. */
  critical: boolean;
  description: string;
  repeating?: boolean;
}

export interface DocumentProfileDefinition {
  id: string;
  version: string;
  status: ProfileStatus;
  title: string;
  description: string;
  /** Top-level (non-repeating) fields. */
  fields: ProfileFieldDefinition[];
  /** Template for one repeating group, e.g. one invoice line item. Empty for profiles with no repeating group. */
  repeatingGroup: { groupPath: string; fields: ProfileFieldDefinition[] } | null;
  validatorIds: string[];
  /** Extraction system prompt — profile-specific instructions layered onto the shared extraction harness prompt. */
  extractionPrompt: string;
}

/** Field paths a profile marks required, for CMP-001 — a fixed list, since only top-level fields can be "always required" independent of how many repeating rows exist. */
export function requiredFieldPaths(profile: DocumentProfileDefinition): string[] {
  return profile.fields.filter((f) => f.required).map((f) => f.path);
}

/** Field paths a profile marks critical among its FIXED fields (see expandCriticalFieldPaths for repeating-group critical paths once a row count is known). */
export function criticalFieldPaths(profile: DocumentProfileDefinition): string[] {
  return profile.fields.filter((f) => f.critical).map((f) => f.path);
}

/** Expand a repeating-group template into concrete field paths once the actual row count is known (e.g. after extraction reports 5 line items). */
export function expandRepeatingFieldPaths(profile: DocumentProfileDefinition, rowCount: number): ProfileFieldDefinition[] {
  if (!profile.repeatingGroup || rowCount <= 0) return [];
  const out: ProfileFieldDefinition[] = [];
  for (let i = 0; i < rowCount; i++) {
    for (const f of profile.repeatingGroup.fields) {
      out.push({ ...f, path: f.path.replace("{i}", String(i)) });
    }
  }
  return out;
}

/** Critical field paths including repeating-group ones, once the row count is known. */
export function expandCriticalFieldPaths(profile: DocumentProfileDefinition, rowCount: number): string[] {
  const fixed = criticalFieldPaths(profile);
  const repeating = expandRepeatingFieldPaths(profile, rowCount)
    .filter((f) => f.critical)
    .map((f) => f.path);
  return [...fixed, ...repeating];
}

/** Required field paths including repeating-group ones for row 0..rowCount-1 — a required repeating field is required on every row that exists. */
export function expandRequiredFieldPaths(profile: DocumentProfileDefinition, rowCount: number): string[] {
  const fixed = requiredFieldPaths(profile);
  const repeating = expandRepeatingFieldPaths(profile, rowCount)
    .filter((f) => f.required)
    .map((f) => f.path);
  return [...fixed, ...repeating];
}
