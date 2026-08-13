import { describe, expect, it } from "vitest";
import { COMPLETENESS_VALIDATORS } from "./completeness.ts";
import { context, field } from "./test-helpers.ts";

const [requiredFieldsAttempted] = COMPLETENESS_VALIDATORS;

describe("CMP-001 required fields attempted", () => {
  it("passes when a required field is honestly marked missing — that IS the compliant behaviour", () => {
    const ctx = context(
      { invoice_number: field("invoice_number", null, { status: "missing" }) },
      { requiredFieldPaths: ["invoice_number"] },
    );
    const [r] = requiredFieldsAttempted.run(ctx);
    expect(r.result.outcome).toBe("pass");
  });

  it("fails and blocks export when a required field has no entry at all", () => {
    const ctx = context({}, { requiredFieldPaths: ["invoice_number"] });
    const [r] = requiredFieldsAttempted.run(ctx);
    expect(r.result.outcome).toBe("fail");
    expect(r.result.blocks_export).toBe(true);
  });

  it("passes when the required field was actually extracted", () => {
    const ctx = context(
      { invoice_number: field("invoice_number", "INV-1") },
      { requiredFieldPaths: ["invoice_number"] },
    );
    expect(requiredFieldsAttempted.run(ctx)[0].result.outcome).toBe("pass");
  });
});
