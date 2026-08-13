import type { ValidatorContext, ValidatorDefinition } from "./types.ts";
import { attach } from "./types.ts";

/**
 * CMP-001 — every field the profile marks required must at least be
 * ATTEMPTED: present in the envelope's fields map with some status.
 *
 * This is deliberately not "must be status extracted" — an honest
 * status: 'missing' is the correct, compliant representation of a value
 * that genuinely isn't on the document. CMP-001 only fails when the
 * extractor skipped a required field entirely, which is a real gap the
 * charter's completeness requirement is meant to catch.
 */
const requiredFieldsAttempted: ValidatorDefinition = {
  id: "CMP-001",
  category: "CMP",
  title: "Required fields attempted",
  description: "Every profile-required field_path has an entry in the envelope (any status, including 'missing').",
  run(ctx: ValidatorContext) {
    return ctx.requiredFieldPaths.map((path) => {
      const present = path in ctx.fields;
      return attach(path, "CMP-001", present ? "pass" : "fail", {
        message: present ? null : `Required field "${path}" has no entry at all in the extraction.`,
        blocks_export: !present,
      });
    });
  },
};

export const COMPLETENESS_VALIDATORS: ValidatorDefinition[] = [requiredFieldsAttempted];
