import type { DocumentProfileDefinition } from "./types.ts";

/**
 * The `commercial_invoice` profile — the governed M5 field set.
 *
 * PROPOSED v0.1. Derived from CLAUDE.md §2 (bounded use case) and the
 * Charter/Workflow Specification's description of a commercial invoice's
 * customs-relevant content, IN THE ABSENCE of the real
 * 02-M5-Commercial-Invoice-Field-Catalogue-and-Annotation-Guide-DRAFT-v0.3.docx
 * (not supplied in the delivered governance package — see CLAUDE.md §4/§5).
 * Swap this file for one derived from the real Field Catalogue when it's
 * available; nothing else in the pipeline needs to change, since a profile
 * is a data row consumed by the same generic engine.
 *
 * Explicitly OUT of scope per Charter §4 and kept out of this field set:
 * HS/tariff classification (hs_code_hints below is verbatim text only, not a
 * classification), CIF/customs valuation, ASYCUDA XML, Najm upload.
 */
export const COMMERCIAL_INVOICE_PROFILE: DocumentProfileDefinition = {
  id: "commercial_invoice",
  version: "0.1",
  status: "PROPOSED",
  title: "Commercial invoice",
  description:
    "Governed field set for a commercial invoice: parties, identifiers, line items, totals, and payment/logistics terms — with full deterministic validation (format, arithmetic, checksum, reference-data, cross-field, evidence, completeness).",
  fields: [
    { path: "seller_name", label: "Seller name", type: "string", required: true, critical: true, description: "The selling/exporting party's legal or trading name." },
    { path: "seller_address", label: "Seller address", type: "string", required: false, critical: false, description: "The seller's full postal address as printed." },
    { path: "seller_vat_id", label: "Seller VAT/Tax ID", type: "string", required: false, critical: false, description: "Seller's VAT number, tax ID, or equivalent registration number, if printed." },
    { path: "buyer_name", label: "Buyer name", type: "string", required: true, critical: true, description: "The buying/importing party's legal or trading name." },
    { path: "buyer_address", label: "Buyer address", type: "string", required: false, critical: false, description: "The buyer's full postal address as printed." },
    { path: "invoice_number", label: "Invoice number", type: "string", required: true, critical: true, description: "The invoice's own identifying number, exactly as printed." },
    { path: "invoice_date", label: "Invoice date", type: "date", required: true, critical: true, description: "The invoice issue date. Normalise to ISO-8601 (YYYY-MM-DD) regardless of the printed format." },
    { path: "currency", label: "Currency", type: "string", required: true, critical: true, description: "The invoice's currency, as an ISO-4217 3-letter code (e.g. USD, EUR, LBP)." },
    { path: "incoterm", label: "Incoterm", type: "string", required: false, critical: false, description: "The Incoterms 2020 rule printed on the invoice (e.g. FOB, CIF, DAP), as a 3-letter code." },
    { path: "payment_terms", label: "Payment terms", type: "string", required: false, critical: false, description: "Payment terms as printed (e.g. 'Net 30', 'Letter of Credit')." },
    { path: "country_of_origin", label: "Country of origin", type: "string", required: false, critical: false, description: "Country of origin of the goods, as printed. Prefer the ISO-3166 alpha-2 code if the country name maps cleanly to one; otherwise the printed name." },
    { path: "bank_iban", label: "Bank IBAN", type: "string", required: false, critical: false, description: "IBAN for the seller's bank account, if printed." },
    { path: "bank_swift", label: "Bank SWIFT/BIC", type: "string", required: false, critical: false, description: "SWIFT/BIC code for the seller's bank, if printed." },
    { path: "subtotal", label: "Subtotal", type: "number", required: true, critical: true, description: "Sum of all line item totals, before discount/tax/freight/insurance adjustments." },
    { path: "discount", label: "Discount", type: "number", required: false, critical: false, description: "Total discount applied, as a positive number to subtract." },
    { path: "freight", label: "Freight", type: "number", required: false, critical: false, description: "Freight/shipping charge, if separately itemised." },
    { path: "insurance", label: "Insurance", type: "number", required: false, critical: false, description: "Insurance charge, if separately itemised." },
    { path: "tax", label: "Tax", type: "number", required: false, critical: false, description: "Tax/VAT amount, if separately itemised." },
    { path: "grand_total", label: "Grand total", type: "number", required: true, critical: true, description: "The final total amount due on the invoice." },
    { path: "hs_code_hints", label: "HS code hints (as printed)", type: "array", required: false, critical: false, description: "Any HS/tariff code text printed on the invoice, copied VERBATIM. This is NOT a customs classification — HS classification is explicitly out of scope for this slice (Charter §4). Only capture what the document itself already states." },
  ],
  repeatingGroup: {
    groupPath: "line_items",
    fields: [
      { path: "line_items[{i}].description", label: "Line item description", type: "string", required: true, critical: false, description: "Description of the goods on this line." },
      { path: "line_items[{i}].quantity", label: "Line item quantity", type: "number", required: true, critical: false, description: "Quantity, as a plain number (unit of measure captured separately if printed)." },
      { path: "line_items[{i}].unit_price", label: "Line item unit price", type: "number", required: true, critical: false, description: "Price per unit, in the invoice's stated currency." },
      { path: "line_items[{i}].line_total", label: "Line item total", type: "number", required: true, critical: true, description: "quantity × unit_price for this line, as printed." },
    ],
  },
  validatorIds: [
    "FMT-INV-001", "FMT-DATE-001", "FMT-CUR-001", "FMT-INCOTERM-001",
    "ARI-001", "ARI-002", "ARI-003",
    "CHK-IBAN-001", "CHK-VAT-001",
    "REF-CUR-001", "REF-INCOTERM-001", "REF-COUNTRY-001",
    "XFD-001", "XFD-002", "XFD-003",
    "EVD-001", "CMP-001",
  ],
  extractionPrompt: `You are extracting a governed field set from ONE commercial invoice (native PDF, scanned PDF, or photograph; English, Arabic, or mixed).

Extract exactly the fields in the field catalogue provided to you, plus one entry per line item found on the invoice (there may be any number of line items, including zero if none are itemised).

Rules, non-negotiable:
- For every field with status 'extracted', you MUST provide at least one evidence quote: a short, VERBATIM substring copied exactly from the transcript (matching whitespace/characters as closely as you can). Do not paraphrase, translate, or normalise the quote itself — only the field's 'value' should be normalised (e.g. dates to ISO-8601); the quote must match what's actually printed.
- Never invent a value to fill a gap. If a field genuinely isn't on the document, set status 'missing' with no evidence. If it's illegible or ambiguous, set status 'uncertain' and explain in 'notes'. If two places on the document disagree, set status 'conflicting' and quote both.
- Normalise invoice_date to ISO-8601 (YYYY-MM-DD) regardless of the source format (including Arabic-Indic numerals and non-Gregorian-looking date strings — read them as printed, converting only the digit script, never the calendar).
- currency and incoterm should be the 3-letter code if you can determine it from context (e.g. "US Dollars" -> "USD"), citing the printed text as evidence.
- hs_code_hints is verbatim text capture ONLY — you are not classifying goods into HS codes, only copying any HS/tariff-code-looking text that already appears on the invoice.
- Do not compute or reconcile arithmetic yourself (line totals, subtotal, grand total) — report what's printed. A separate deterministic validator checks the arithmetic; your job is faithful transcription, not correction.`,
};
