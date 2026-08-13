import type { ValidatorContext, ValidatorDefinition } from "./types.ts";
import { attach } from "./types.ts";
import { COUNTRY_CODES_SUBSET, CURRENCY_CODES_SUBSET, INCOTERMS_2020 } from "./reference-data.ts";

/** REF-CUR-001 — currency is a recognised ISO-4217 code (Incoterms list is complete; currency/country lists are subsets — see reference-data.ts). */
const currencyReference: ValidatorDefinition = {
  id: "REF-CUR-001",
  category: "REF",
  title: "Currency reference lookup",
  description: "currency is present in the curated currency subset.",
  run(ctx: ValidatorContext) {
    const field = ctx.fields["currency"];
    if (!field || field.status !== "extracted" || typeof field.value !== "string") return [];
    const ok = CURRENCY_CODES_SUBSET.has(field.value);
    return [
      attach("currency", "REF-CUR-001", ok ? "pass" : "warn", {
        message: ok ? null : `"${field.value}" is not in the reference subset — verify manually (list is partial, not authoritative).`,
      }),
    ];
  },
};

/** REF-INCOTERM-001 — incoterm is one of the 11 official Incoterms 2020 codes (this list IS complete/authoritative). */
const incotermReference: ValidatorDefinition = {
  id: "REF-INCOTERM-001",
  category: "REF",
  title: "Incoterms 2020 lookup",
  description: "incoterm is one of the 11 official Incoterms 2020 rules.",
  run(ctx: ValidatorContext) {
    const field = ctx.fields["incoterm"];
    if (!field || field.status !== "extracted" || typeof field.value !== "string") return [];
    const ok = INCOTERMS_2020.has(field.value);
    return [
      attach("incoterm", "REF-INCOTERM-001", ok ? "pass" : "fail", {
        message: ok ? null : `"${field.value}" is not one of the 11 Incoterms 2020 rules.`,
      }),
    ];
  },
};

/** REF-COUNTRY-001 — country_of_origin is a recognised ISO-3166 alpha-2 code (subset — see reference-data.ts). */
const countryReference: ValidatorDefinition = {
  id: "REF-COUNTRY-001",
  category: "REF",
  title: "Country reference lookup",
  description: "country_of_origin is present in the curated country-code subset.",
  run(ctx: ValidatorContext) {
    const field = ctx.fields["country_of_origin"];
    if (!field || field.status !== "extracted" || typeof field.value !== "string") return [];
    const ok = COUNTRY_CODES_SUBSET.has(field.value.toUpperCase());
    return [
      attach("country_of_origin", "REF-COUNTRY-001", ok ? "pass" : "warn", {
        message: ok ? null : `"${field.value}" is not in the reference subset — verify manually (list is partial, not authoritative).`,
      }),
    ];
  },
};

export const REFERENCE_VALIDATORS: ValidatorDefinition[] = [
  currencyReference,
  incotermReference,
  countryReference,
];
