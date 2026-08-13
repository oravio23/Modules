/**
 * Generates the synthetic (fictional, never real) fixture set used by:
 *   - offline normaliser tests (fixtures/formats/*)
 *   - the eval harness and e2e pipeline runs (fixtures/invoices/*, fixtures/generic/*)
 *
 * Per Charter §3/§5 and Task Protocol §7: every name, address, number, and
 * IBAN below is invented for this fixture set. None of it is derived from or
 * resembles any real KLS document — no real client data has been supplied to
 * or used by this project (risk R-005).
 *
 * Usage: npx tsx scripts/generate-fixtures.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import JSZip from "jszip";
import * as XLSX from "xlsx";
import { buildMinimalPdf } from "./lib/minimal-pdf.ts";
import { buildMinimalPng } from "./lib/minimal-png.ts";
import { buildMinimalDocx } from "./lib/minimal-docx.ts";
import { buildMinimalPptx } from "./lib/minimal-pptx.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const fixturesDir = path.join(root, "fixtures");

function ensureDir(p: string) {
  mkdirSync(p, { recursive: true });
}

function writeText(p: string, content: string) {
  ensureDir(path.dirname(p));
  writeFileSync(p, content, "utf8");
}

function writeBinary(p: string, content: Buffer) {
  ensureDir(path.dirname(p));
  writeFileSync(p, content);
}

function writeJson(p: string, value: unknown) {
  writeText(p, JSON.stringify(value, null, 2) + "\n");
}

// ── Invoice scenarios ────────────────────────────────────────────────────────

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

interface InvoiceScenario {
  id: string;
  description: string;
  seller_name: string;
  buyer_name: string;
  invoice_number: string;
  invoice_date: string;
  currency: string;
  incoterm: string;
  country_of_origin: string;
  bank_iban: string;
  bank_swift: string;
  seller_vat_id: string;
  payment_terms: string;
  line_items: LineItem[];
  subtotal: number;
  discount: number;
  freight: number;
  insurance: number;
  tax: number;
  grand_total: number;
  /** Fields to omit from the printed document entirely (tests honest 'missing' status). */
  omitFromDocument?: string[];
  /** Note describing why this scenario is interesting, for humans reading the fixture set. */
  note: string;
}

const CLEAN: InvoiceScenario = {
  id: "clean",
  description: "A fully consistent commercial invoice — every arithmetic and reference check should pass.",
  seller_name: "Meridian Trading Co.",
  buyer_name: "Kabbani Logistics Services (Fictional Test Buyer)",
  invoice_number: "INV-2026-0417",
  invoice_date: "2026-08-01",
  currency: "USD",
  incoterm: "FOB",
  country_of_origin: "LB",
  bank_iban: "DE89370400440532013000",
  bank_swift: "COBADEFFXXX",
  seller_vat_id: "LB123456789",
  payment_terms: "Net 30",
  line_items: [
    { description: "Ceramic floor tiles, 60x60cm, grade A", quantity: 10, unit_price: 5, line_total: 50 },
    { description: "Adhesive mortar, 25kg bag", quantity: 3, unit_price: 10, line_total: 30 },
  ],
  subtotal: 80,
  discount: 10,
  freight: 15,
  insurance: 2,
  tax: 5,
  grand_total: 92,
  note: "Baseline — used as the reference case for field-level accuracy in the eval harness.",
};

const CONFLICTING_TOTALS: InvoiceScenario = {
  ...CLEAN,
  id: "conflicting-totals",
  invoice_number: "INV-2026-0418",
  description: "Same as 'clean' but the printed grand total does not reconcile with subtotal/adjustments — ARI-003 should fail and block export.",
  grand_total: 500, // printed wrong on purpose; ARI-003 should catch subtotal(80) - discount(10) + tax(5) + freight(15) + insurance(2) = 92 != 500
  note: "Deliberately wrong grand_total. Tests ARI-003 fail + blocks_export, and that the field is still marked requires_review.",
};

const MISSING_REQUIRED: InvoiceScenario = {
  ...CLEAN,
  id: "missing-required",
  invoice_number: "INV-2026-0419",
  description: "buyer_name and invoice_date are never printed on the document at all.",
  omitFromDocument: ["buyer_name", "invoice_date"],
  note: "Tests that an honestly absent required field is reported as status 'missing' (CMP-001 pass) — never a guessed value (Charter core policy).",
};

const DISCOUNT_FLAG: InvoiceScenario = {
  ...CLEAN,
  id: "discount-flag",
  invoice_number: "INV-2026-0420",
  description: "Carries a discount line — Workflow Specification §3 flags discount-on-invoice as a compliance item for human review, not something this pipeline auto-resolves.",
  discount: 25,
  grand_total: 77, // 80 - 25 + 5 + 15 + 2
  note: "R-011 / Workflow Spec §3: discount-on-invoice is a noted compliance flag, surfaced for human review — not decided or auto-resolved by this codebase.",
};

const INVOICE_SCENARIOS: InvoiceScenario[] = [CLEAN, CONFLICTING_TOTALS, MISSING_REQUIRED, DISCOUNT_FLAG];

function formatMoney(n: number): string {
  return n.toFixed(2);
}

function renderInvoiceTranscript(inv: InvoiceScenario): string {
  const omit = new Set(inv.omitFromDocument ?? []);
  const lines: string[] = [];
  lines.push(`COMMERCIAL INVOICE`);
  lines.push(``);
  lines.push(`Seller: ${inv.seller_name}`);
  lines.push(`Seller VAT ID: ${inv.seller_vat_id}`);
  if (!omit.has("buyer_name")) lines.push(`Buyer: ${inv.buyer_name}`);
  lines.push(``);
  lines.push(`Invoice No.: ${inv.invoice_number}`);
  if (!omit.has("invoice_date")) lines.push(`Invoice Date: ${inv.invoice_date}`);
  lines.push(`Currency: ${inv.currency}`);
  lines.push(`Incoterm: ${inv.incoterm}`);
  lines.push(`Country of Origin: ${inv.country_of_origin}`);
  lines.push(`Payment Terms: ${inv.payment_terms}`);
  lines.push(``);
  lines.push(`Line Items:`);
  inv.line_items.forEach((li, i) => {
    lines.push(`  ${i + 1}. ${li.description} | Qty: ${li.quantity} | Unit Price: ${formatMoney(li.unit_price)} | Total: ${formatMoney(li.line_total)}`);
  });
  lines.push(``);
  lines.push(`Subtotal: ${formatMoney(inv.subtotal)}`);
  lines.push(`Discount: ${formatMoney(inv.discount)}`);
  lines.push(`Freight: ${formatMoney(inv.freight)}`);
  lines.push(`Insurance: ${formatMoney(inv.insurance)}`);
  lines.push(`Tax: ${formatMoney(inv.tax)}`);
  lines.push(`GRAND TOTAL: ${formatMoney(inv.grand_total)}`);
  lines.push(``);
  lines.push(`Bank IBAN: ${inv.bank_iban}`);
  lines.push(`Bank SWIFT: ${inv.bank_swift}`);
  return lines.join("\n");
}

function goldenForInvoice(inv: InvoiceScenario) {
  const omit = new Set(inv.omitFromDocument ?? []);
  const fields: Record<string, unknown> = {
    seller_name: inv.seller_name,
    buyer_name: omit.has("buyer_name") ? null : inv.buyer_name,
    invoice_number: inv.invoice_number,
    invoice_date: omit.has("invoice_date") ? null : inv.invoice_date,
    currency: inv.currency,
    incoterm: inv.incoterm,
    country_of_origin: inv.country_of_origin,
    payment_terms: inv.payment_terms,
    seller_vat_id: inv.seller_vat_id,
    bank_iban: inv.bank_iban,
    bank_swift: inv.bank_swift,
    subtotal: inv.subtotal,
    discount: inv.discount,
    freight: inv.freight,
    insurance: inv.insurance,
    tax: inv.tax,
    grand_total: inv.grand_total,
  };
  inv.line_items.forEach((li, i) => {
    fields[`line_items[${i}].description`] = li.description;
    fields[`line_items[${i}].quantity`] = li.quantity;
    fields[`line_items[${i}].unit_price`] = li.unit_price;
    fields[`line_items[${i}].line_total`] = li.line_total;
  });
  return {
    scenario_id: inv.id,
    description: inv.description,
    note: inv.note,
    profile_id: "commercial_invoice",
    missing_fields: [...omit],
    expected_field_values: fields,
    expect_validator_outcomes: inv.id === "conflicting-totals" ? { "ARI-003": "fail" } : inv.id === "missing-required" ? { "CMP-001": "pass" } : {},
  };
}

async function writeInvoiceScenario(inv: InvoiceScenario) {
  const dir = path.join(fixturesDir, "invoices", inv.id);
  const transcript = renderInvoiceTranscript(inv);
  writeText(path.join(dir, "transcript.txt"), transcript);
  writeJson(path.join(dir, "golden.json"), goldenForInvoice(inv));
  const pdf = buildMinimalPdf({ lines: transcript.split("\n"), fontSize: 9, lineHeight: 12 });
  writeBinary(path.join(dir, "document.pdf"), pdf);
  console.log(`invoice fixture: ${inv.id}`);
}

// ── Arabic / mixed-script scenario (transcript only — see note in generate-fixtures header) ─

const ARABIC_MIXED_TRANSCRIPT = `فاتورة تجارية / COMMERCIAL INVOICE

البائع / Seller: شركة الاتحاد للتجارة (Al-Ittihad Trading Co.)
المشتري / Buyer: شركة كباني للخدمات اللوجستية (Kabbani Logistics Services)

رقم الفاتورة / Invoice No.: INV-٢٠٢٦-٠٥٠١
تاريخ الفاتورة / Invoice Date: ٢٠٢٦-٠٨-٠٢
العملة / Currency: USD

الأصناف / Line Items:
  ١. بلاط سيراميك 60x60 سم — الكمية: ١٠ — سعر الوحدة: 5.00 — الإجمالي: 50.00
  ٢. مادة لاصقة 25 كجم — الكمية: ٣ — سعر الوحدة: 10.00 — الإجمالي: 30.00

المجموع الفرعي / Subtotal: 80.00
الإجمالي الكلي / GRAND TOTAL: 80.00
`;

function writeArabicMixedScenario() {
  const dir = path.join(fixturesDir, "invoices", "arabic-mixed");
  writeText(path.join(dir, "transcript.txt"), ARABIC_MIXED_TRANSCRIPT);
  writeJson(path.join(dir, "golden.json"), {
    scenario_id: "arabic-mixed",
    description: "Bilingual Arabic/English invoice using Arabic-Indic numerals in the Arabic portion.",
    note:
      "No PDF fixture: a hand-rolled minimal PDF can't embed an Arabic-capable font. This scenario exercises arabic.ts normalisation and the anchoring gate directly (see supabase/functions/_shared/arabic.test.ts and validation/anchor.test.ts), and is meant to be run through the real pipeline once a genuine Arabic PDF/scan is available.",
    profile_id: "commercial_invoice",
    expected_field_values: {
      seller_name: "Al-Ittihad Trading Co.",
      buyer_name: "Kabbani Logistics Services",
      invoice_number: "INV-2026-0501",
      invoice_date: "2026-08-02",
      currency: "USD",
      subtotal: 80,
      grand_total: 80,
      "line_items[0].quantity": 10,
      "line_items[0].unit_price": 5,
      "line_items[0].line_total": 50,
      "line_items[1].quantity": 3,
      "line_items[1].unit_price": 10,
      "line_items[1].line_total": 30,
    },
  });
  console.log("invoice fixture: arabic-mixed (transcript only)");
}

// ── Generic-profile scenario: a non-invoice document ────────────────────────

function writeGenericScenario() {
  const dir = path.join(fixturesDir, "generic", "delivery-note");
  const lines = [
    "DELIVERY NOTE",
    "",
    "Delivery Note No.: DN-2026-0091",
    "Date: 2026-08-03",
    "From: Meridian Trading Co. Warehouse 2",
    "To: Kabbani Logistics Services — Beirut Port Gate 4",
    "",
    "Items delivered:",
    "  - 10x Ceramic floor tiles, 60x60cm (crate #A12)",
    "  - 3x Adhesive mortar, 25kg bag (crate #A13)",
    "",
    "Received by: _______________________ (signature on file, not transcribed)",
    "Note: Partial delivery — remainder to follow per PO 2026-Q3-118.",
  ];
  const transcript = lines.join("\n");
  writeText(path.join(dir, "transcript.txt"), transcript);
  writeJson(path.join(dir, "golden.json"), {
    scenario_id: "delivery-note",
    description: "Not a commercial invoice — tests that profile classification picks 'generic', not 'commercial_invoice'.",
    profile_id: "generic",
    expected_document_type_guess_contains: "delivery",
    expected_key_values: [
      { label: "Delivery Note No.", value: "DN-2026-0091" },
      { label: "Date", value: "2026-08-03" },
    ],
  });
  const pdf = buildMinimalPdf({ lines, fontSize: 9, lineHeight: 12 });
  writeBinary(path.join(dir, "document.pdf"), pdf);
  console.log("generic fixture: delivery-note");
}

// ── Format-coverage fixtures (exercise each ingest normaliser) ──────────────

async function writeFormatFixtures() {
  const dir = path.join(fixturesDir, "formats");

  writeText(path.join(dir, "sample.txt"), "Plain text fixture.\nSecond line.\nInvoice-like content: Total 42.00 USD.");
  writeText(path.join(dir, "sample.md"), "# Sample Markdown\n\nA **fixture** for the text normaliser.");
  writeText(path.join(dir, "sample.csv"), "item,quantity,unit_price\nWidget,4,2.50\nGadget,1,9.99\n");
  writeText(path.join(dir, "sample.json"), JSON.stringify({ note: "JSON fixture", total: 42 }, null, 2));

  // .eml — minimal valid RFC 5322 message with a small base64 text attachment.
  const attachmentText = Buffer.from("Attached note: see invoice INV-2026-0417.", "utf8").toString("base64");
  const eml = [
    "From: sender@example-fixture.test",
    "To: recipient@example-fixture.test",
    "Subject: Invoice INV-2026-0417",
    "MIME-Version: 1.0",
    'Content-Type: multipart/mixed; boundary="fixture-boundary"',
    "",
    "--fixture-boundary",
    "Content-Type: text/plain; charset=utf-8",
    "",
    "Please find the invoice attached. Total due: 92.00 USD.",
    "",
    "--fixture-boundary",
    "Content-Type: text/plain; name=note.txt",
    "Content-Disposition: attachment; filename=note.txt",
    "Content-Transfer-Encoding: base64",
    "",
    attachmentText,
    "",
    "--fixture-boundary--",
    "",
  ].join("\r\n");
  writeText(path.join(dir, "sample.eml"), eml);

  // .png — structurally valid, solid color (see minimal-png.ts docstring for scope).
  writeBinary(path.join(dir, "sample.png"), buildMinimalPng(64, 64));

  // .pdf — reuse the 'clean' invoice content already generated.
  writeBinary(path.join(dir, "sample.pdf"), buildMinimalPdf({ lines: renderInvoiceTranscript(CLEAN).split("\n") }));

  // .docx
  writeBinary(
    path.join(dir, "sample.docx"),
    await buildMinimalDocx(["Sample Word Document", "", "Invoice INV-2026-0417", "Total: 92.00 USD"]),
  );

  // .pptx — two slides
  writeBinary(
    path.join(dir, "sample.pptx"),
    await buildMinimalPptx([
      ["Title Slide", "Oravio M5 — Fixture Deck"],
      ["Slide 2", "Invoice INV-2026-0417", "Total: 92.00 USD"],
    ]),
  );

  // .xlsx — one sheet, invoice-shaped
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ["Invoice No.", "INV-2026-0417"],
    ["Date", "2026-08-01"],
    [],
    ["Description", "Quantity", "Unit Price", "Line Total"],
    ["Ceramic floor tiles, 60x60cm, grade A", 10, 5, 50],
    ["Adhesive mortar, 25kg bag", 3, 10, 30],
    [],
    ["Subtotal", "", "", 80],
    ["Grand Total", "", "", 92],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, "Invoice");
  const xlsxBuf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  writeBinary(path.join(dir, "sample.xlsx"), xlsxBuf);

  // .zip — bundles a few of the above, for the recursive zip normaliser.
  const zip = new JSZip();
  zip.file("readme.txt", "Zip fixture containing a mix of document types.");
  zip.file("invoice.pdf", buildMinimalPdf({ lines: renderInvoiceTranscript(CLEAN).split("\n") }));
  zip.file("notes.txt", "Some plain-text notes bundled alongside the invoice.");
  const zipBuf = await zip.generateAsync({ type: "nodebuffer" });
  writeBinary(path.join(dir, "sample.zip"), zipBuf);

  console.log("format-coverage fixtures written");
}

// ── Manifest ─────────────────────────────────────────────────────────────────

async function main() {
  for (const inv of INVOICE_SCENARIOS) await writeInvoiceScenario(inv);
  writeArabicMixedScenario();
  writeGenericScenario();
  await writeFormatFixtures();

  const manifest = {
    generated_note: "Synthetic fixtures only — see scripts/generate-fixtures.ts header. No real client data.",
    invoices: [...INVOICE_SCENARIOS.map((i) => i.id), "arabic-mixed"],
    generic: ["delivery-note"],
    formats: [
      "sample.txt", "sample.md", "sample.csv", "sample.json", "sample.eml",
      "sample.png", "sample.pdf", "sample.docx", "sample.pptx", "sample.xlsx", "sample.zip",
    ],
  };
  writeJson(path.join(fixturesDir, "manifest.json"), manifest);
  console.log("wrote fixtures/manifest.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
