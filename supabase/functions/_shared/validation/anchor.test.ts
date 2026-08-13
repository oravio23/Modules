import { describe, expect, it } from "vitest";
import { anchorEvidenceItem, anchorField, hasVerifiedEvidence } from "./anchor.ts";
import type { EvidenceDraft, FieldResultDraft, PartTranscript } from "../envelope-types.ts";

const transcripts: PartTranscript[] = [
  { part_ordinal: 1, direction: "ltr", text: "Invoice No. INV-2026-0417\nDate: 2026-08-01\nTotal: 1,250.00 USD" },
  { part_ordinal: 2, direction: "rtl", text: "فاتورة رقم ٤١٧ بتاريخ ٢٠٢٦-٠٨-٠١" },
];

describe("anchorEvidenceItem", () => {
  it("verifies an exact substring match and reports real character offsets", () => {
    const draft: EvidenceDraft = { part_ordinal: 1, quote: "INV-2026-0417" };
    const result = anchorEvidenceItem(draft, transcripts);
    expect(result.anchor).toBe("verified");
    expect(result.char_start).toBe(transcripts[0].text.indexOf("INV-2026-0417"));
    expect(result.char_end).toBe(result.char_start! + "INV-2026-0417".length);
  });

  it("verifies via normalised match when Arabic-Indic numerals differ from the transcript's ASCII form", () => {
    // Model quotes the invoice number using Arabic-Indic digits; transcript stored it in ASCII.
    const draft: EvidenceDraft = { part_ordinal: 1, quote: "INV-٢٠٢٦-٠٤١٧" };
    const result = anchorEvidenceItem(draft, transcripts);
    expect(result.anchor).toBe("verified");
    // Offsets are null for a fuzzy/normalised match — honest about not knowing the raw position.
    expect(result.char_start).toBeNull();
    expect(result.char_end).toBeNull();
  });

  it("verifies Arabic text despite diacritics not present in the transcript", () => {
    const draft: EvidenceDraft = { part_ordinal: 2, quote: "فَاتُورَة رقم ٤١٧" };
    const result = anchorEvidenceItem(draft, transcripts);
    expect(result.anchor).toBe("verified");
  });

  it("marks a fabricated quote as unverified — the core anti-hallucination check", () => {
    const draft: EvidenceDraft = { part_ordinal: 1, quote: "Total: 9,999,999.00 USD" };
    const result = anchorEvidenceItem(draft, transcripts);
    expect(result.anchor).toBe("unverified");
    expect(result.char_start).toBeNull();
    expect(result.char_end).toBeNull();
  });

  it("marks a quote referencing a non-existent part as unverified", () => {
    const draft: EvidenceDraft = { part_ordinal: 99, quote: "anything" };
    const result = anchorEvidenceItem(draft, transcripts);
    expect(result.anchor).toBe("unverified");
  });

  it("treats an empty quote as unverified rather than trivially matching", () => {
    const draft: EvidenceDraft = { part_ordinal: 1, quote: "   " };
    const result = anchorEvidenceItem(draft, transcripts);
    expect(result.anchor).toBe("unverified");
  });
});

describe("anchorField / hasVerifiedEvidence", () => {
  it("anchors every evidence item on a field draft", () => {
    const draft: FieldResultDraft = {
      field_path: "invoice_number",
      field_label: "Invoice number",
      value: "INV-2026-0417",
      status: "extracted",
      confidence: 0.95,
      evidence: [{ part_ordinal: 1, quote: "INV-2026-0417" }],
    };
    const anchored = anchorField(draft, transcripts);
    expect(hasVerifiedEvidence(anchored)).toBe(true);
  });

  it("a field whose only evidence fails to anchor has no verified evidence", () => {
    const draft: FieldResultDraft = {
      field_path: "grand_total",
      field_label: "Grand total",
      value: 9999999,
      status: "extracted",
      confidence: 0.4,
      evidence: [{ part_ordinal: 1, quote: "9,999,999.00" }],
    };
    const anchored = anchorField(draft, transcripts);
    expect(hasVerifiedEvidence(anchored)).toBe(false);
  });

  it("a field with no evidence at all has no verified evidence", () => {
    const draft: FieldResultDraft = {
      field_path: "notes",
      field_label: "Notes",
      value: null,
      status: "missing",
      confidence: null,
      evidence: [],
    };
    const anchored = anchorField(draft, transcripts);
    expect(hasVerifiedEvidence(anchored)).toBe(false);
  });
});
