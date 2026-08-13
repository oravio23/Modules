import { describe, expect, it } from "vitest";
import { EVIDENCE_VALIDATORS } from "./evidence.ts";
import { context, field } from "./test-helpers.ts";

const [evidenceIntegrity] = EVIDENCE_VALIDATORS;

describe("EVD-001 evidence integrity", () => {
  it("passes an extracted field with verified evidence", () => {
    const ctx = context({ invoice_number: field("invoice_number", "INV-1", { verified: true }) });
    expect(evidenceIntegrity.run(ctx)[0].result.outcome).toBe("pass");
  });

  it("fails and blocks export when a CRITICAL field has no verified evidence", () => {
    const ctx = context(
      { grand_total: field("grand_total", 100, { verified: false }) },
      { criticalFieldPaths: ["grand_total"] },
    );
    const [r] = evidenceIntegrity.run(ctx);
    expect(r.result.outcome).toBe("fail");
    expect(r.result.blocks_export).toBe(true);
  });

  it("warns (does not block export) when a NON-critical field has no verified evidence", () => {
    const ctx = context(
      { notes_field: field("notes_field", "some ancillary text", { verified: false }) },
      { criticalFieldPaths: ["grand_total"] },
    );
    const [r] = evidenceIntegrity.run(ctx);
    expect(r.result.outcome).toBe("warn");
    expect(r.result.blocks_export).toBe(false);
  });

  it("is not_applicable for a field that was never extracted", () => {
    const ctx = context({ invoice_number: field("invoice_number", null, { status: "missing" }) });
    expect(evidenceIntegrity.run(ctx)[0].result.outcome).toBe("not_applicable");
  });
});
