import { describe, expect, it } from "vitest";
import { REFERENCE_VALIDATORS } from "./reference.ts";
import { context, field } from "./test-helpers.ts";

const [currencyReference, incotermReference, countryReference] = REFERENCE_VALIDATORS;

describe("REF-INCOTERM-001 (complete, authoritative list)", () => {
  it("passes every one of the 11 official Incoterms 2020 codes", () => {
    for (const code of ["EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"]) {
      const ctx = context({ incoterm: field("incoterm", code) });
      expect(incotermReference.run(ctx)[0].result.outcome).toBe("pass");
    }
  });

  it("fails a code that isn't part of Incoterms 2020", () => {
    const ctx = context({ incoterm: field("incoterm", "XXX") });
    expect(incotermReference.run(ctx)[0].result.outcome).toBe("fail");
  });
});

describe("REF-CUR-001 / REF-COUNTRY-001 (partial subsets — warn, never silently fail)", () => {
  it("passes a currency in the reference subset", () => {
    const ctx = context({ currency: field("currency", "USD") });
    expect(currencyReference.run(ctx)[0].result.outcome).toBe("pass");
  });

  it("warns (not fails) on a currency outside the curated subset — the list is partial, not authoritative", () => {
    const ctx = context({ currency: field("currency", "ZZZ") });
    const [r] = currencyReference.run(ctx);
    expect(r.result.outcome).toBe("warn");
    expect(r.result.message).toMatch(/partial/i);
  });

  it("passes a country in the reference subset", () => {
    const ctx = context({ country_of_origin: field("country_of_origin", "LB") });
    expect(countryReference.run(ctx)[0].result.outcome).toBe("pass");
  });
});
