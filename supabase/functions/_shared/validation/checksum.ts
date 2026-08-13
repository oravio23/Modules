import type { ValidatorContext, ValidatorDefinition } from "./types.ts";
import { attach } from "./types.ts";

/**
 * IBAN mod-97 check (ISO 7064 MOD 97-10), the standard IBAN checksum.
 * Processes the numeric string in chunks to avoid needing BigInt for the
 * (potentially 30+ digit) intermediate value.
 */
export function isValidIban(raw: string): boolean {
  const iban = raw.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = [...rearranged]
    .map((ch) => (/[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch))
    .join("");
  let remainder = 0;
  for (let i = 0; i < numeric.length; i += 7) {
    const chunk = String(remainder) + numeric.slice(i, i + 7);
    remainder = Number(chunk) % 97;
  }
  return remainder === 1;
}

/**
 * Structural (not checksum) validation for VAT-style identifiers: a 2-letter
 * country prefix followed by 2-15 alphanumerics. Actual VAT checksum
 * algorithms are country-specific and not implemented here — this catches
 * gross format errors only, and says so in its message.
 */
export function looksLikeVatId(raw: string): boolean {
  return /^[A-Z]{2}[A-Z0-9]{2,15}$/.test(raw.replace(/\s+/g, "").toUpperCase());
}

/** EORI numbers: 2-letter country code + up to 15 alphanumerics (structural only). */
export function looksLikeEori(raw: string): boolean {
  return /^[A-Z]{2}[A-Z0-9]{1,15}$/.test(raw.replace(/\s+/g, "").toUpperCase());
}

const ibanValidator: ValidatorDefinition = {
  id: "CHK-IBAN-001",
  category: "CHK",
  title: "IBAN checksum",
  description: "bank_iban passes the ISO 7064 MOD 97-10 checksum.",
  run(ctx: ValidatorContext) {
    const field = ctx.fields["bank_iban"];
    if (!field) return [];
    if (field.status !== "extracted") return [attach("bank_iban", "CHK-IBAN-001", "not_applicable")];
    if (typeof field.value !== "string") {
      return [attach("bank_iban", "CHK-IBAN-001", "fail", { message: "Value is not a string." })];
    }
    const ok = isValidIban(field.value);
    return [
      attach("bank_iban", "CHK-IBAN-001", ok ? "pass" : "fail", {
        message: ok ? null : `"${field.value}" does not pass the IBAN checksum.`,
        blocks_export: !ok,
      }),
    ];
  },
};

const vatValidator: ValidatorDefinition = {
  id: "CHK-VAT-001",
  category: "CHK",
  title: "VAT ID structure",
  description: "seller_vat_id has a plausible VAT-ID shape (country prefix + alphanumeric). Structural only — no country-specific checksum.",
  run(ctx: ValidatorContext) {
    const field = ctx.fields["seller_vat_id"];
    if (!field) return [];
    if (field.status !== "extracted") return [attach("seller_vat_id", "CHK-VAT-001", "not_applicable")];
    if (typeof field.value !== "string") {
      return [attach("seller_vat_id", "CHK-VAT-001", "fail", { message: "Value is not a string." })];
    }
    const ok = looksLikeVatId(field.value);
    return [
      attach("seller_vat_id", "CHK-VAT-001", ok ? "pass" : "warn", {
        message: ok ? null : `"${field.value}" doesn't match the expected VAT-ID shape — verify manually.`,
      }),
    ];
  },
};

export const CHECKSUM_VALIDATORS: ValidatorDefinition[] = [ibanValidator, vatValidator];
