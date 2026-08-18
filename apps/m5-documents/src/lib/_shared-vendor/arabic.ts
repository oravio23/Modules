// VENDORED — copied verbatim from supabase/functions/_shared by scripts/vendor-shared.mjs.
// Do not hand-edit: edit the source in supabase/functions/_shared and re-run
// `node scripts/vendor-shared.mjs` (also runs automatically on postinstall/build).

/**
 * Arabic / mixed-script text normalisation.
 *
 * Shared, portable module (no Deno or Node APIs) — imported directly by:
 *   - supabase/functions/_shared/validation/anchor.ts (the evidence-anchoring gate)
 *   - src/lib/arabic.ts (frontend: RTL detection, evidence highlighting)
 *   - vitest unit tests
 *
 * This is the module that makes "never silently invent a value" hold for
 * Arabic and mixed-script documents: a model-emitted evidence quote that used
 * Arabic-Indic numerals or diacritics must still anchor against a transcript
 * that may render either variant, or the field is forced into review.
 */

/** Arabic-Indic (٠-٩) and Extended Arabic-Indic (۰-۹) digits, in order 0-9. */
const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const EXTENDED_ARABIC_INDIC_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/** Arabic combining diacritics (tashkeel) — fatha, damma, kasra, shadda, sukun, tanwin, etc. */
const ARABIC_DIACRITICS_RE = /[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۨ-ۭ]/g;

/** Tatweel / kashida (Arabic justification elongation character) — purely visual, never semantic. */
const TATWEEL_RE = /ـ/g;

/** Convert Arabic-Indic and Extended Arabic-Indic digits to plain ASCII 0-9. */
export function normalizeArabicNumerals(input: string): string {
  let out = "";
  for (const ch of input) {
    const a = ARABIC_INDIC_DIGITS.indexOf(ch);
    if (a !== -1) {
      out += String(a);
      continue;
    }
    const b = EXTENDED_ARABIC_INDIC_DIGITS.indexOf(ch);
    if (b !== -1) {
      out += String(b);
      continue;
    }
    out += ch;
  }
  return out;
}

/** Strip Arabic diacritics (tashkeel) and tatweel — they never carry meaning for matching. */
export function stripArabicDiacritics(input: string): string {
  return input.replace(ARABIC_DIACRITICS_RE, "").replace(TATWEEL_RE, "");
}

/**
 * Canonical form used for quote-anchoring and any other fuzzy text comparison
 * in this app: collapse whitespace, normalise Unicode (NFKC — this also folds
 * Arabic presentation-form ligatures back to their base letters), strip
 * diacritics/tatweel, normalise digits, and lowercase (Latin case has no
 * meaning for invoice text matching; Arabic has no case).
 */
export function normalizeForMatch(input: string): string {
  return stripArabicDiacritics(normalizeArabicNumerals(input.normalize("NFKC")))
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const ARABIC_BLOCK_RE = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

/** True if the string contains any Arabic-script codepoint. */
export function containsArabic(input: string): boolean {
  return ARABIC_BLOCK_RE.test(input);
}

/**
 * Rough per-string script mix, used to pick a transcript's `direction` and to
 * surface `document.languages` in the envelope. Not a language identifier —
 * just script presence, which is all the pipeline needs to decide RTL
 * rendering and to know Arabic-aware normalisation is in play.
 */
export function detectScriptMix(input: string): { hasArabic: boolean; hasLatin: boolean } {
  return {
    hasArabic: ARABIC_BLOCK_RE.test(input),
    hasLatin: /[A-Za-z]/.test(input),
  };
}

/** Suggested CSS/HTML `dir` for a block of text, for the review-pane renderer. */
export function suggestDirection(input: string): "ltr" | "rtl" | "auto" {
  const { hasArabic, hasLatin } = detectScriptMix(input);
  if (hasArabic && hasLatin) return "auto";
  if (hasArabic) return "rtl";
  return "ltr";
}
