import { describe, expect, it } from "vitest";
import { FORMAT_VALIDATORS, isValidIsoDate } from "./format.ts";
import { context, field } from "./test-helpers.ts";

const [invoiceNumberFormat, dateFormat, currencyFormat, incotermFormat] = FORMAT_VALIDATORS;

describe("isValidIsoDate", () => {
  it("accepts a real calendar date", () => expect(isValidIsoDate("2026-08-01")).toBe(true));
  it("rejects a non-existent date (Feb 30)", () => expect(isValidIsoDate("2026-02-30")).toBe(false));
  it("rejects a malformed string", () => expect(isValidIsoDate("08/01/2026")).toBe(false));
});

describe("FMT-INV-001 invoice number format", () => {
  it("passes a normal invoice number", () => {
    const ctx = context({ invoice_number: field("invoice_number", "INV-2026-0417") });
    const [r] = invoiceNumberFormat.run(ctx);
    expect(r.result.outcome).toBe("pass");
  });

  it("warns on an unusual shape rather than failing outright", () => {
    const ctx = context({ invoice_number: field("invoice_number", "###!!!") });
    const [r] = invoiceNumberFormat.run(ctx);
    expect(r.result.outcome).toBe("warn");
  });

  it("is not_applicable when the field is honestly missing", () => {
    const ctx = context({ invoice_number: field("invoice_number", null, { status: "missing" }) });
    const [r] = invoiceNumberFormat.run(ctx);
    expect(r.result.outcome).toBe("not_applicable");
  });
});

describe("FMT-DATE-001 date format", () => {
  it("passes a valid invoice_date", () => {
    const ctx = context({ invoice_date: field("invoice_date", "2026-08-01") });
    const [r] = dateFormat.run(ctx);
    expect(r.result.outcome).toBe("pass");
  });

  it("fails an invalid calendar date", () => {
    const ctx = context({ invoice_date: field("invoice_date", "2026-13-40") });
    const [r] = dateFormat.run(ctx);
    expect(r.result.outcome).toBe("fail");
  });

  it("only checks fields ending in _date", () => {
    const ctx = context({ invoice_number: field("invoice_number", "INV-1") });
    expect(dateFormat.run(ctx)).toHaveLength(0);
  });
});

describe("FMT-CUR-001 / FMT-INCOTERM-001 shape checks", () => {
  it("passes a 3-letter currency code", () => {
    const ctx = context({ currency: field("currency", "USD") });
    expect(currencyFormat.run(ctx)[0].result.outcome).toBe("pass");
  });

  it("fails a malformed currency code", () => {
    const ctx = context({ currency: field("currency", "US Dollars") });
    expect(currencyFormat.run(ctx)[0].result.outcome).toBe("fail");
  });

  it("passes a valid Incoterms shape", () => {
    const ctx = context({ incoterm: field("incoterm", "FOB") });
    expect(incotermFormat.run(ctx)[0].result.outcome).toBe("pass");
  });
});
