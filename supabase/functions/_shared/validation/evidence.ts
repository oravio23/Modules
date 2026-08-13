import type { ValidatorContext, ValidatorDefinition } from "./types.ts";
import { attach } from "./types.ts";
import { hasVerifiedEvidence } from "./anchor.ts";

/**
 * EVD-001 — evidence integrity, the enforcement point for the anchoring gate.
 *
 * Any field with status 'extracted' must carry at least one evidence item
 * whose anchor is 'verified' (see anchor.ts). If it doesn't — every quote
 * the model offered failed to match the stored transcript — the field is
 * unanchored. For a profile-critical field this is a hard fail that blocks
 * export; for a non-critical field it's a warning. Either way requires_review
 * is forced true by the pipeline layer (see envelope.ts) regardless of this
 * validator's outcome — this validator's job is only to make the failure
 * visible and, for critical fields, to block a trusted export.
 */
const evidenceIntegrity: ValidatorDefinition = {
  id: "EVD-001",
  category: "EVD",
  title: "Evidence integrity",
  description: "Every extracted field has at least one verified-anchor evidence quote.",
  run(ctx: ValidatorContext) {
    const out = [];
    for (const [path, field] of Object.entries(ctx.fields)) {
      if (field.status !== "extracted") {
        out.push(attach(path, "EVD-001", "not_applicable"));
        continue;
      }
      const ok = hasVerifiedEvidence(field);
      if (ok) {
        out.push(attach(path, "EVD-001", "pass"));
        continue;
      }
      const critical = ctx.criticalFieldPaths.includes(path);
      out.push(
        attach(path, "EVD-001", critical ? "fail" : "warn", {
          message: field.evidence.length === 0
            ? "No evidence was provided for this extracted value."
            : "No evidence quote for this field could be matched against the stored transcript.",
          blocks_export: critical,
        }),
      );
    }
    return out;
  },
};

export const EVIDENCE_VALIDATORS: ValidatorDefinition[] = [evidenceIntegrity];
