import { describe, expect, it } from "vitest";
import {
  containsArabic,
  normalizeArabicNumerals,
  normalizeForMatch,
  stripArabicDiacritics,
  suggestDirection,
} from "./arabic.ts";

describe("normalizeArabicNumerals", () => {
  it("converts Arabic-Indic digits to ASCII", () => {
    expect(normalizeArabicNumerals("٠١٢٣٤٥٦٧٨٩")).toBe("0123456789");
  });

  it("converts Extended Arabic-Indic (Persian/Urdu) digits to ASCII", () => {
    expect(normalizeArabicNumerals("۰۱۲۳۴۵۶۷۸۹")).toBe("0123456789");
  });

  it("leaves ASCII digits and other text untouched", () => {
    expect(normalizeArabicNumerals("Invoice #012 — total 99.50")).toBe("Invoice #012 — total 99.50");
  });

  it("handles mixed Arabic and ASCII digits in one string", () => {
    expect(normalizeArabicNumerals("رقم الفاتورة ٤١٧-INV")).toBe("رقم الفاتورة 417-INV");
  });
});

describe("stripArabicDiacritics", () => {
  it("removes tashkeel marks", () => {
    // "invoice" (فاتورة) with fatha/damma diacritics added
    const withDiacritics = "فَاتُورَة";
    const stripped = stripArabicDiacritics(withDiacritics);
    expect(stripped).toBe("فاتورة");
  });

  it("removes tatweel elongation characters", () => {
    expect(stripArabicDiacritics("مـــرحبا")).toBe("مرحبا");
  });

  it("is a no-op on plain Latin text", () => {
    expect(stripArabicDiacritics("Invoice No. 417")).toBe("Invoice No. 417");
  });
});

describe("normalizeForMatch", () => {
  it("collapses whitespace, folds case, and normalises digits together", () => {
    const a = normalizeForMatch("  Invoice   No.   INV-2026-0417  ");
    const b = normalizeForMatch("invoice no. inv-2026-0417");
    expect(a).toBe(b);
  });

  it("makes a diacritic-marked Arabic quote match its plain form", () => {
    const withDiacritics = normalizeForMatch("فَاتُورَة رقم ٤١٧");
    const plain = normalizeForMatch("فاتورة رقم 417");
    expect(withDiacritics).toBe(plain);
  });
});

describe("containsArabic / suggestDirection", () => {
  it("detects Arabic script", () => {
    expect(containsArabic("مرحبا")).toBe(true);
    expect(containsArabic("Hello")).toBe(false);
  });

  it("suggests rtl for pure Arabic, ltr for pure Latin, auto for mixed", () => {
    expect(suggestDirection("مرحبا بالعالم")).toBe("rtl");
    expect(suggestDirection("Hello world")).toBe("ltr");
    expect(suggestDirection("Invoice رقم 417")).toBe("auto");
  });
});
