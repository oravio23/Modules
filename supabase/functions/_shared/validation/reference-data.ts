/**
 * Reference-data tables for REF-* validators.
 *
 * Per Charter §5 / R-006 / R-007: reference lists are cited honestly as
 * partial where they are partial. INCOTERMS_2020 is the complete, official
 * 11-code list (small and stable enough to be authoritative). CURRENCY_CODES
 * and COUNTRY_CODES are representative subsets, NOT the full ISO-4217 /
 * ISO-3166 lists — a code missing from these tables gets a 'warn' outcome
 * ("not in reference subset — verify manually"), never a silent 'fail' that
 * would imply the code is invalid.
 */

/** The complete Incoterms® 2020 rule set (11 codes) — ICC, effective 2020-01-01. */
export const INCOTERMS_2020 = new Set([
  "EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP",
]);

/**
 * Common ISO-4217 currency codes. Representative subset covering the
 * currencies expected in the KLS/Lebanon trade corridor plus major world
 * currencies — NOT the full ISO-4217 table (~180 codes).
 */
export const CURRENCY_CODES_SUBSET = new Set([
  "USD", "EUR", "GBP", "LBP", "AED", "SAR", "QAR", "KWD", "BHD", "OMR", "JOD",
  "EGP", "TRY", "CNY", "JPY", "CHF", "CAD", "AUD", "INR", "SGD", "HKD",
]);

/**
 * Common ISO-3166-1 alpha-2 country codes. Representative subset —
 * NOT the full ISO-3166 table (~250 entries).
 */
export const COUNTRY_CODES_SUBSET = new Set([
  "LB", "SY", "JO", "IQ", "EG", "SA", "AE", "QA", "KW", "BH", "OM", "TR",
  "CN", "US", "GB", "DE", "FR", "IT", "ES", "NL", "BE", "CH", "IN", "PK",
  "GR", "CY", "RU", "UA", "JP", "KR", "SG", "HK", "AU", "CA", "BR", "ZA",
]);

/**
 * Common UN/ECE Recommendation 20 unit-of-measure codes. Representative
 * subset — NOT the full Rec 20 table.
 */
export const UOM_CODES_SUBSET = new Set([
  "PCE", "KGM", "GRM", "LTR", "MTR", "MTQ", "MTK", "SET", "PR", "BOX",
  "CTN", "PLT", "ROL", "DZN", "TNE",
]);
