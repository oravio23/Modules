-- Seed data for m5.profiles, ported from the M5 pilot's generated seed
-- (originally supabase/migrations/0003_seed_profiles.sql, regenerated there by
-- npx tsx scripts/generate-seed.ts from supabase/functions/_shared/profiles/*.ts).
-- GENERATED FILE — do not hand-edit; regenerate the same way once this module has its own
-- specs/export pipeline wired to this repo, then reapply the schema-qualification here.

-- GENERATED FILE — do not hand-edit.
-- Regenerate with: npx tsx scripts/generate-seed.ts
-- Source of truth: supabase/functions/_shared/profiles/*.ts

insert into m5.profiles (id, version, status, title, description, schema, prompt, validator_ids)
values (
  'generic',
  '0.1',
  'PROPOSED'::m5.profile_status,
  'Generic document',
  'No fixed field set. Produces a document-type guess, a short summary, and whatever key-values, tables, entities, dates, and amounts the document actually contains.',
  $seed${"fields":[{"path":"document_type_guess","label":"Document type (guess)","type":"string","required":true,"critical":false,"description":"A short, plain-language guess at what kind of document this is (e.g. 'delivery note', 'employment contract', 'lab report'). Not a classification into a fixed taxonomy."},{"path":"summary","label":"Summary","type":"string","required":true,"critical":false,"description":"A 1-3 sentence factual summary of the document's content. No speculation about intent or missing context."}],"repeating_group":{"groupPath":"key_values","fields":[{"path":"key_values[{i}].label","label":"Key-value label","type":"string","required":false,"critical":false,"description":"The label/key as printed or clearly implied on the document (e.g. 'PO Number', 'Reference')."},{"path":"key_values[{i}].value","label":"Key-value value","type":"string","required":false,"critical":false,"description":"The value associated with that label."}]}}$seed$::jsonb,
  $seed$You are extracting structured content from a document you have not seen a fixed schema for.

Read the transcript(s) provided and produce:
- document_type_guess: a short, plain-language guess at the document type.
- summary: 1-3 factual sentences.
- Zero or more key_values entries: any clearly labelled field/value pairs on the document (form fields, headers, metadata blocks). Do not invent labels that aren't there.
- Zero or more entities, dates, amounts, or tables you can identify, each as its own field with its own evidence.

For every field you emit, you MUST provide at least one evidence quote: a short, VERBATIM substring copied exactly from the transcript that supports the value. Do not paraphrase the quote. If you cannot find a supporting quote, do not emit the field — mark it status 'missing' instead, or omit it if it's part of an optional repeating group.

Never invent a value to fill a gap. If a field is illegible, ambiguous, or contradicted elsewhere in the document, set its status to 'uncertain' or 'conflicting' and explain why in 'notes' — do not silently pick one reading.$seed$,
  array['EVD-001', 'CMP-001']
)
on conflict (id) do update set
  version = excluded.version,
  status = excluded.status,
  title = excluded.title,
  description = excluded.description,
  schema = excluded.schema,
  prompt = excluded.prompt,
  validator_ids = excluded.validator_ids;

insert into m5.profiles (id, version, status, title, description, schema, prompt, validator_ids)
values (
  'commercial_invoice',
  '0.1',
  'PROPOSED'::m5.profile_status,
  'Commercial invoice',
  'Governed field set for a commercial invoice: parties, identifiers, line items, totals, and payment/logistics terms — with full deterministic validation (format, arithmetic, checksum, reference-data, cross-field, evidence, completeness).',
  $seed${"fields":[{"path":"seller_name","label":"Seller name","type":"string","required":true,"critical":true,"description":"The selling/exporting party's legal or trading name."},{"path":"seller_address","label":"Seller address","type":"string","required":false,"critical":false,"description":"The seller's full postal address as printed."},{"path":"seller_vat_id","label":"Seller VAT/Tax ID","type":"string","required":false,"critical":false,"description":"Seller's VAT number, tax ID, or equivalent registration number, if printed."},{"path":"buyer_name","label":"Buyer name","type":"string","required":true,"critical":true,"description":"The buying/importing party's legal or trading name."},{"path":"buyer_address","label":"Buyer address","type":"string","required":false,"critical":false,"description":"The buyer's full postal address as printed."},{"path":"invoice_number","label":"Invoice number","type":"string","required":true,"critical":true,"description":"The invoice's own identifying number, exactly as printed."},{"path":"invoice_date","label":"Invoice date","type":"date","required":true,"critical":true,"description":"The invoice issue date. Normalise to ISO-8601 (YYYY-MM-DD) regardless of the printed format."},{"path":"currency","label":"Currency","type":"string","required":true,"critical":true,"description":"The invoice's currency, as an ISO-4217 3-letter code (e.g. USD, EUR, LBP)."},{"path":"incoterm","label":"Incoterm","type":"string","required":false,"critical":false,"description":"The Incoterms 2020 rule printed on the invoice (e.g. FOB, CIF, DAP), as a 3-letter code."},{"path":"payment_terms","label":"Payment terms","type":"string","required":false,"critical":false,"description":"Payment terms as printed (e.g. 'Net 30', 'Letter of Credit')."},{"path":"country_of_origin","label":"Country of origin","type":"string","required":false,"critical":false,"description":"Country of origin of the goods, as printed. Prefer the ISO-3166 alpha-2 code if the country name maps cleanly to one; otherwise the printed name."},{"path":"bank_iban","label":"Bank IBAN","type":"string","required":false,"critical":false,"description":"IBAN for the seller's bank account, if printed."},{"path":"bank_swift","label":"Bank SWIFT/BIC","type":"string","required":false,"critical":false,"description":"SWIFT/BIC code for the seller's bank, if printed."},{"path":"subtotal","label":"Subtotal","type":"number","required":true,"critical":true,"description":"Sum of all line item totals, before discount/tax/freight/insurance adjustments."},{"path":"discount","label":"Discount","type":"number","required":false,"critical":false,"description":"Total discount applied, as a positive number to subtract."},{"path":"freight","label":"Freight","type":"number","required":false,"critical":false,"description":"Freight/shipping charge, if separately itemised."},{"path":"insurance","label":"Insurance","type":"number","required":false,"critical":false,"description":"Insurance charge, if separately itemised."},{"path":"tax","label":"Tax","type":"number","required":false,"critical":false,"description":"Tax/VAT amount, if separately itemised."},{"path":"grand_total","label":"Grand total","type":"number","required":true,"critical":true,"description":"The final total amount due on the invoice."},{"path":"hs_code_hints","label":"HS code hints (as printed)","type":"array","required":false,"critical":false,"description":"Any HS/tariff code text printed on the invoice, copied VERBATIM. This is NOT a customs classification — HS classification is explicitly out of scope for this slice (Charter §4). Only capture what the document itself already states."}],"repeating_group":{"groupPath":"line_items","fields":[{"path":"line_items[{i}].description","label":"Line item description","type":"string","required":true,"critical":false,"description":"Description of the goods on this line."},{"path":"line_items[{i}].quantity","label":"Line item quantity","type":"number","required":true,"critical":false,"description":"Quantity, as a plain number (unit of measure captured separately if printed)."},{"path":"line_items[{i}].unit_price","label":"Line item unit price","type":"number","required":true,"critical":false,"description":"Price per unit, in the invoice's stated currency."},{"path":"line_items[{i}].line_total","label":"Line item total","type":"number","required":true,"critical":true,"description":"quantity × unit_price for this line, as printed."}]}}$seed$::jsonb,
  $seed$You are extracting a governed field set from ONE commercial invoice (native PDF, scanned PDF, or photograph; English, Arabic, or mixed).

Extract exactly the fields in the field catalogue provided to you, plus one entry per line item found on the invoice (there may be any number of line items, including zero if none are itemised).

Rules, non-negotiable:
- For every field with status 'extracted', you MUST provide at least one evidence quote: a short, VERBATIM substring copied exactly from the transcript (matching whitespace/characters as closely as you can). Do not paraphrase, translate, or normalise the quote itself — only the field's 'value' should be normalised (e.g. dates to ISO-8601); the quote must match what's actually printed.
- Never invent a value to fill a gap. If a field genuinely isn't on the document, set status 'missing' with no evidence. If it's illegible or ambiguous, set status 'uncertain' and explain in 'notes'. If two places on the document disagree, set status 'conflicting' and quote both.
- Normalise invoice_date to ISO-8601 (YYYY-MM-DD) regardless of the source format (including Arabic-Indic numerals and non-Gregorian-looking date strings — read them as printed, converting only the digit script, never the calendar).
- currency and incoterm should be the 3-letter code if you can determine it from context (e.g. "US Dollars" -> "USD"), citing the printed text as evidence.
- hs_code_hints is verbatim text capture ONLY — you are not classifying goods into HS codes, only copying any HS/tariff-code-looking text that already appears on the invoice.
- Do not compute or reconcile arithmetic yourself (line totals, subtotal, grand total) — report what's printed. A separate deterministic validator checks the arithmetic; your job is faithful transcription, not correction.$seed$,
  array['FMT-INV-001', 'FMT-DATE-001', 'FMT-CUR-001', 'FMT-INCOTERM-001', 'ARI-001', 'ARI-002', 'ARI-003', 'CHK-IBAN-001', 'CHK-VAT-001', 'REF-CUR-001', 'REF-INCOTERM-001', 'REF-COUNTRY-001', 'XFD-001', 'XFD-002', 'XFD-003', 'EVD-001', 'CMP-001']
)
on conflict (id) do update set
  version = excluded.version,
  status = excluded.status,
  title = excluded.title,
  description = excluded.description,
  schema = excluded.schema,
  prompt = excluded.prompt,
  validator_ids = excluded.validator_ids;
