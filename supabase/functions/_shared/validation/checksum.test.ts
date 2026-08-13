import { describe, expect, it } from "vitest";
import { CHECKSUM_VALIDATORS, isValidIban, looksLikeEori, looksLikeVatId } from "./checksum.ts";
import { context, field } from "./test-helpers.ts";

const [ibanValidator, vatValidator] = CHECKSUM_VALIDATORS;

describe("isValidIban", () => {
  it("accepts a well-known valid test IBAN", () => {
    // Standard IBAN mod-97 example (Germany)
    expect(isValidIban("DE89370400440532013000")).toBe(true);
  });

  it("accepts a valid IBAN with spaces, as commonly printed on invoices", () => {
    expect(isValidIban("DE89 3704 0044 0532 0130 00")).toBe(true);
  });

  it("rejects an IBAN with a single transposed digit", () => {
    expect(isValidIban("DE89370400440532013001")).toBe(false);
  });

  it("rejects a malformed string", () => {
    expect(isValidIban("not-an-iban")).toBe(false);
  });
});

describe("CHK-IBAN-001", () => {
  it("passes a checksum-valid IBAN", () => {
    const ctx = context({ bank_iban: field("bank_iban", "DE89370400440532013000") });
    expect(ibanValidator.run(ctx)[0].result.outcome).toBe("pass");
  });

  it("fails and blocks export on a checksum-invalid IBAN", () => {
    const ctx = context({ bank_iban: field("bank_iban", "DE89370400440532013001") });
    const [r] = ibanValidator.run(ctx);
    expect(r.result.outcome).toBe("fail");
    expect(r.result.blocks_export).toBe(true);
  });
});

describe("VAT / EORI structural checks", () => {
  it("looksLikeVatId accepts a plausible VAT-ID shape", () => {
    expect(looksLikeVatId("LB1234567")).toBe(true);
  });
  it("looksLikeVatId rejects an implausible shape", () => {
    expect(looksLikeVatId("not a vat id!!")).toBe(false);
  });
  it("looksLikeEori accepts a plausible EORI shape", () => {
    expect(looksLikeEori("LB123456789")).toBe(true);
  });

  it("CHK-VAT-001 warns (not fails) on a bad shape — no country-specific checksum exists", () => {
    const ctx = context({ seller_vat_id: field("seller_vat_id", "????") });
    expect(vatValidator.run(ctx)[0].result.outcome).toBe("warn");
  });
});
