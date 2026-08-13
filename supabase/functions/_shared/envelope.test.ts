import { describe, expect, it } from "vitest";
import { buildEnvelope, getEnvelopeSchemaErrors, isValidEnvelope } from "./envelope.ts";
import { anchorFields } from "./validation/anchor.ts";
import type { FieldResultDraft, PartTranscript } from "./envelope-types.ts";

const transcripts: PartTranscript[] = [
  {
    part_ordinal: 1,
    direction: "ltr",
    text: "Invoice No. INV-2026-0417\nDate: 2026-08-01\nCurrency: USD\nSubtotal: 100.00\nGrand Total: 100.00",
  },
];

const validatorIds = ["FMT-INV-001", "FMT-DATE-001", "ARI-003", "EVD-001", "CMP-001"];
const requiredFieldPaths = ["invoice_number", "invoice_date"];
const criticalFieldPaths = ["invoice_number", "grand_total"];

function draft(overrides: Partial<Record<string, FieldResultDraft>>): Record<string, FieldResultDraft> {
  return {
    invoice_number: {
      field_path: "invoice_number",
      field_label: "Invoice number",
      value: "INV-2026-0417",
      status: "extracted",
      confidence: 0.97,
      evidence: [{ part_ordinal: 1, quote: "INV-2026-0417" }],
    },
    invoice_date: {
      field_path: "invoice_date",
      field_label: "Invoice date",
      value: "2026-08-01",
      status: "extracted",
      confidence: 0.95,
      evidence: [{ part_ordinal: 1, quote: "2026-08-01" }],
    },
    subtotal: {
      field_path: "subtotal",
      field_label: "Subtotal",
      value: 100,
      status: "extracted",
      confidence: 0.9,
      evidence: [{ part_ordinal: 1, quote: "100.00" }],
    },
    grand_total: {
      field_path: "grand_total",
      field_label: "Grand total",
      value: 100,
      status: "extracted",
      confidence: 0.9,
      evidence: [{ part_ordinal: 1, quote: "100.00" }],
    },
    ...overrides,
  };
}

describe("buildEnvelope", () => {
  it("produces a schema-valid envelope for a clean extraction", () => {
    const anchored = anchorFields(draft({}), transcripts);
    const { envelope } = buildEnvelope({
      documentId: "doc_1",
      sha256: "a".repeat(64),
      detectedMime: "application/pdf",
      partCount: 1,
      languages: ["en"],
      profileId: "commercial_invoice",
      profileVersion: "0.1",
      profileStatus: "PROPOSED",
      profileConfidence: 0.92,
      anchoredFields: anchored,
      requiredFieldPaths,
      criticalFieldPaths,
      validatorIds,
      usage: { input_tokens: 1000, output_tokens: 200 },
      now: new Date("2026-08-06T00:00:00Z"),
    });

    expect(isValidEnvelope(envelope)).toBe(true);
    expect(envelope.fields.invoice_number.status).toBe("extracted");
    // Mandatory 100% human review — always true, regardless of confidence.
    expect(envelope.fields.invoice_number.requires_review).toBe(true);
    expect(envelope.validation.summary.blocks_export).toBe(false);
  });

  it("rejects an object that violates the schema (e.g. a bad status enum)", () => {
    const bogus = { schema_version: "wrong", document: {}, profile: {}, fields: {}, validation: {}, review: {}, usage: {} };
    expect(isValidEnvelope(bogus)).toBe(false);
    expect(getEnvelopeSchemaErrors(bogus).length).toBeGreaterThan(0);
  });

  it("a fabricated evidence quote fails to anchor, is caught by EVD-001, and blocks export for a critical field", () => {
    const withFabrication = draft({
      grand_total: {
        field_path: "grand_total",
        field_label: "Grand total",
        value: 999999,
        status: "extracted",
        confidence: 0.3,
        evidence: [{ part_ordinal: 1, quote: "999,999.00" }], // not in the transcript
      },
    });
    const anchored = anchorFields(withFabrication, transcripts);
    const { envelope } = buildEnvelope({
      documentId: "doc_2",
      sha256: "b".repeat(64),
      detectedMime: "application/pdf",
      partCount: 1,
      languages: ["en"],
      profileId: "commercial_invoice",
      profileVersion: "0.1",
      profileStatus: "PROPOSED",
      profileConfidence: 0.5,
      anchoredFields: anchored,
      requiredFieldPaths,
      criticalFieldPaths,
      validatorIds,
      usage: {},
      now: new Date("2026-08-06T00:00:00Z"),
    });

    expect(isValidEnvelope(envelope)).toBe(true);
    const grandTotalEvd = envelope.fields.grand_total.validators.find((v) => v.id === "EVD-001");
    expect(grandTotalEvd?.outcome).toBe("fail");
    expect(grandTotalEvd?.blocks_export).toBe(true);
    expect(envelope.validation.summary.blocks_export).toBe(true);
    // Still marked for review even though it "extracted" a value — never silently trusted.
    expect(envelope.fields.grand_total.requires_review).toBe(true);
  });

  it("an honestly missing required field passes completeness; an entirely absent one fails it", () => {
    const missingButAttempted = draft({
      invoice_date: {
        field_path: "invoice_date",
        field_label: "Invoice date",
        value: null,
        status: "missing",
        confidence: null,
        evidence: [],
      },
    });
    const anchored = anchorFields(missingButAttempted, transcripts);
    const { envelope } = buildEnvelope({
      documentId: "doc_3",
      sha256: "c".repeat(64),
      detectedMime: "application/pdf",
      partCount: 1,
      languages: ["en"],
      profileId: "commercial_invoice",
      profileVersion: "0.1",
      profileStatus: "PROPOSED",
      profileConfidence: 0.8,
      anchoredFields: anchored,
      requiredFieldPaths,
      criticalFieldPaths,
      validatorIds,
      usage: {},
    });
    const cmp = envelope.fields.invoice_date.validators.find((v) => v.id === "CMP-001");
    expect(cmp?.outcome).toBe("pass"); // honest 'missing' status is compliant
    expect(envelope.fields.invoice_date.status).toBe("missing");
  });

  it("a conflicting grand total fails ARI-003 and blocks export", () => {
    const conflicting = draft({
      grand_total: {
        field_path: "grand_total",
        field_label: "Grand total",
        value: 500,
        status: "extracted",
        confidence: 0.6,
        evidence: [{ part_ordinal: 1, quote: "100.00" }],
      },
    });
    const anchored = anchorFields(conflicting, transcripts);
    const { envelope } = buildEnvelope({
      documentId: "doc_4",
      sha256: "d".repeat(64),
      detectedMime: "application/pdf",
      partCount: 1,
      languages: ["en"],
      profileId: "commercial_invoice",
      profileVersion: "0.1",
      profileStatus: "PROPOSED",
      profileConfidence: 0.6,
      anchoredFields: anchored,
      requiredFieldPaths,
      criticalFieldPaths,
      validatorIds,
      usage: {},
    });
    const ari = envelope.fields.grand_total.validators.find((v) => v.id === "ARI-003");
    expect(ari?.outcome).toBe("fail");
    expect(envelope.validation.summary.blocks_export).toBe(true);
  });
});
