import type { ValidatorContext, ValidatorDefinition } from "./types.ts";
import { attach } from "./types.ts";

/** Fields whose value should read as a plausible date string (YYYY-MM-DD). */
const DATE_FIELD_SUFFIXES = ["_date"];

function isExtractedString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/** FMT-INV-001 — invoice_number is a non-empty, reasonably-shaped identifier. */
const invoiceNumberFormat: ValidatorDefinition = {
  id: "FMT-INV-001",
  category: "FMT",
  title: "Invoice number format",
  description: "invoice_number matches a plausible identifier pattern (alphanumeric plus -/_. separators, 2–40 chars).",
  run(ctx: ValidatorContext) {
    const field = ctx.fields["invoice_number"];
    if (!field || field.status !== "extracted") {
      return field ? [attach("invoice_number", "FMT-INV-001", "not_applicable")] : [];
    }
    const value = field.value;
    if (!isExtractedString(value)) {
      return [attach("invoice_number", "FMT-INV-001", "fail", { message: "Value is not a string." })];
    }
    const ok = /^[A-Za-z0-9][A-Za-z0-9\-/_.]{1,39}$/.test(value.trim());
    return [
      attach("invoice_number", "FMT-INV-001", ok ? "pass" : "warn", {
        message: ok ? null : `"${value}" doesn't match the expected identifier shape — verify manually.`,
      }),
    ];
  },
};

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  // Reject e.g. 2026-02-30 silently rolling over to March.
  return d.toISOString().slice(0, 10) === value;
}

/** FMT-DATE-001 — every *_date field is a real, ISO-8601 calendar date. */
const dateFormat: ValidatorDefinition = {
  id: "FMT-DATE-001",
  category: "FMT",
  title: "Date format",
  description: "Fields ending in _date are valid ISO-8601 dates (YYYY-MM-DD) and real calendar dates.",
  run(ctx: ValidatorContext) {
    const out = [];
    for (const [path, field] of Object.entries(ctx.fields)) {
      if (!DATE_FIELD_SUFFIXES.some((s) => path.endsWith(s))) continue;
      if (field.status !== "extracted") {
        out.push(attach(path, "FMT-DATE-001", "not_applicable"));
        continue;
      }
      if (!isExtractedString(field.value)) {
        out.push(attach(path, "FMT-DATE-001", "fail", { message: "Value is not a string." }));
        continue;
      }
      const ok = isValidIsoDate(field.value);
      out.push(
        attach(path, "FMT-DATE-001", ok ? "pass" : "fail", {
          message: ok ? null : `"${field.value}" is not a valid ISO-8601 date.`,
        }),
      );
    }
    return out;
  },
};

/** FMT-CUR-001 — currency is a 3-uppercase-letter code shape (membership checked separately by REF-CUR-001). */
const currencyFormat: ValidatorDefinition = {
  id: "FMT-CUR-001",
  category: "FMT",
  title: "Currency code format",
  description: "currency matches the ISO-4217 shape: exactly 3 uppercase letters.",
  run(ctx: ValidatorContext) {
    const field = ctx.fields["currency"];
    if (!field) return [];
    if (field.status !== "extracted") return [attach("currency", "FMT-CUR-001", "not_applicable")];
    if (!isExtractedString(field.value)) {
      return [attach("currency", "FMT-CUR-001", "fail", { message: "Value is not a string." })];
    }
    const ok = /^[A-Z]{3}$/.test(field.value);
    return [
      attach("currency", "FMT-CUR-001", ok ? "pass" : "fail", {
        message: ok ? null : `"${field.value}" is not a 3-letter ISO-4217 shape.`,
      }),
    ];
  },
};

/** FMT-INCOTERM-001 — incoterm is a 3-uppercase-letter code shape (membership checked separately). */
const incotermFormat: ValidatorDefinition = {
  id: "FMT-INCOTERM-001",
  category: "FMT",
  title: "Incoterm code format",
  description: "incoterm matches the Incoterms shape: exactly 3 uppercase letters.",
  run(ctx: ValidatorContext) {
    const field = ctx.fields["incoterm"];
    if (!field) return [];
    if (field.status !== "extracted") return [attach("incoterm", "FMT-INCOTERM-001", "not_applicable")];
    if (!isExtractedString(field.value)) {
      return [attach("incoterm", "FMT-INCOTERM-001", "fail", { message: "Value is not a string." })];
    }
    const ok = /^[A-Z]{3}$/.test(field.value);
    return [
      attach("incoterm", "FMT-INCOTERM-001", ok ? "pass" : "fail", {
        message: ok ? null : `"${field.value}" is not a 3-letter Incoterms shape.`,
      }),
    ];
  },
};

export const FORMAT_VALIDATORS: ValidatorDefinition[] = [
  invoiceNumberFormat,
  dateFormat,
  currencyFormat,
  incotermFormat,
];

export { isValidIsoDate };
