import { describe, expect, it } from "vitest";
import { CROSSFIELD_VALIDATORS } from "./crossfield.ts";
import { context, field } from "./test-helpers.ts";

const [invoiceDateNotFuture, monetaryNonNegative, sellerNotBuyer] = CROSSFIELD_VALIDATORS;

describe("XFD-001 invoice date not in the future", () => {
  const now = new Date("2026-08-06T12:00:00Z");

  it("passes a past date", () => {
    const ctx = context({ invoice_date: field("invoice_date", "2026-08-01") }, { now });
    expect(invoiceDateNotFuture.run(ctx)[0].result.outcome).toBe("pass");
  });

  it("passes today exactly", () => {
    const ctx = context({ invoice_date: field("invoice_date", "2026-08-06") }, { now });
    expect(invoiceDateNotFuture.run(ctx)[0].result.outcome).toBe("pass");
  });

  it("fails a date in the future", () => {
    const ctx = context({ invoice_date: field("invoice_date", "2026-09-01") }, { now });
    expect(invoiceDateNotFuture.run(ctx)[0].result.outcome).toBe("fail");
  });
});

describe("XFD-002 monetary fields non-negative", () => {
  it("passes non-negative values", () => {
    const ctx = context({ subtotal: field("subtotal", 100), tax: field("tax", 0) });
    const results = monetaryNonNegative.run(ctx);
    expect(results.every((r) => r.result.outcome === "pass")).toBe(true);
  });

  it("fails a negative monetary value", () => {
    const ctx = context({ subtotal: field("subtotal", -50) });
    expect(monetaryNonNegative.run(ctx)[0].result.outcome).toBe("fail");
  });
});

describe("XFD-003 seller distinct from buyer", () => {
  it("passes distinct parties", () => {
    const ctx = context({
      seller_name: field("seller_name", "Acme Trading Co."),
      buyer_name: field("buyer_name", "Kabbani Logistics Services"),
    });
    expect(sellerNotBuyer.run(ctx)[0].result.outcome).toBe("pass");
  });

  it("fails when seller and buyer are the same, even with different casing/spacing", () => {
    const ctx = context({
      seller_name: field("seller_name", "Acme Trading Co."),
      buyer_name: field("buyer_name", "  acme   trading co.  "),
    });
    expect(sellerNotBuyer.run(ctx)[0].result.outcome).toBe("fail");
  });
});
