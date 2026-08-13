import { describe, expect, it } from "vitest";
import { ARITHMETIC_VALIDATORS } from "./arithmetic.ts";
import { context, field } from "./test-helpers.ts";

const [lineItemTotal, subtotalSum, grandTotal] = ARITHMETIC_VALIDATORS;

describe("ARI-001 line item arithmetic", () => {
  it("passes when quantity * unit_price = line_total exactly", () => {
    const ctx = context({
      "line_items[0].quantity": field("line_items[0].quantity", 10),
      "line_items[0].unit_price": field("line_items[0].unit_price", 5),
      "line_items[0].line_total": field("line_items[0].line_total", 50),
    });
    const [r] = lineItemTotal.run(ctx);
    expect(r.result.outcome).toBe("pass");
  });

  it("passes within the one-minor-unit tolerance (rounding)", () => {
    const ctx = context({
      "line_items[0].quantity": field("line_items[0].quantity", 3),
      "line_items[0].unit_price": field("line_items[0].unit_price", 3.333),
      "line_items[0].line_total": field("line_items[0].line_total", 10.0), // 3*3.333 = 9.999
    });
    const [r] = lineItemTotal.run(ctx);
    expect(r.result.outcome).toBe("pass");
  });

  it("fails and blocks export when the arithmetic is genuinely wrong", () => {
    const ctx = context({
      "line_items[0].quantity": field("line_items[0].quantity", 10),
      "line_items[0].unit_price": field("line_items[0].unit_price", 5),
      "line_items[0].line_total": field("line_items[0].line_total", 999),
    });
    const [r] = lineItemTotal.run(ctx);
    expect(r.result.outcome).toBe("fail");
    expect(r.result.blocks_export).toBe(true);
  });

  it("is not_applicable when a component is missing rather than assuming zero", () => {
    const ctx = context({
      "line_items[0].quantity": field("line_items[0].quantity", 10),
      "line_items[0].unit_price": field("line_items[0].unit_price", null, { status: "missing" }),
      "line_items[0].line_total": field("line_items[0].line_total", 50),
    });
    const [r] = lineItemTotal.run(ctx);
    expect(r.result.outcome).toBe("not_applicable");
  });

  it("checks every line item independently by index", () => {
    const ctx = context({
      "line_items[0].quantity": field("line_items[0].quantity", 1),
      "line_items[0].unit_price": field("line_items[0].unit_price", 1),
      "line_items[0].line_total": field("line_items[0].line_total", 1),
      "line_items[1].quantity": field("line_items[1].quantity", 2),
      "line_items[1].unit_price": field("line_items[1].unit_price", 2),
      "line_items[1].line_total": field("line_items[1].line_total", 999),
    });
    const results = lineItemTotal.run(ctx);
    expect(results).toHaveLength(2);
    expect(results.find((r) => r.field_path === "line_items[0].line_total")?.result.outcome).toBe("pass");
    expect(results.find((r) => r.field_path === "line_items[1].line_total")?.result.outcome).toBe("fail");
  });
});

describe("ARI-002 subtotal sum", () => {
  it("passes when line totals sum to subtotal", () => {
    const ctx = context({
      "line_items[0].line_total": field("line_items[0].line_total", 50),
      "line_items[1].line_total": field("line_items[1].line_total", 30),
      subtotal: field("subtotal", 80),
    });
    expect(subtotalSum.run(ctx)[0].result.outcome).toBe("pass");
  });

  it("fails and blocks export on a mismatched subtotal", () => {
    const ctx = context({
      "line_items[0].line_total": field("line_items[0].line_total", 50),
      "line_items[1].line_total": field("line_items[1].line_total", 30),
      subtotal: field("subtotal", 999),
    });
    const [r] = subtotalSum.run(ctx);
    expect(r.result.outcome).toBe("fail");
    expect(r.result.blocks_export).toBe(true);
  });

  it("returns nothing when there are no line items to sum", () => {
    const ctx = context({ subtotal: field("subtotal", 80) });
    expect(subtotalSum.run(ctx)).toHaveLength(0);
  });
});

describe("ARI-003 grand total arithmetic", () => {
  it("passes a full breakdown: subtotal - discount + tax + freight + insurance = grand_total", () => {
    const ctx = context({
      subtotal: field("subtotal", 100),
      discount: field("discount", 10),
      tax: field("tax", 5),
      freight: field("freight", 15),
      insurance: field("insurance", 2),
      grand_total: field("grand_total", 112), // 100 - 10 + 5 + 15 + 2
    });
    expect(grandTotal.run(ctx)[0].result.outcome).toBe("pass");
  });

  it("treats an absent adjustment field (not part of the profile) as zero", () => {
    const ctx = context({
      subtotal: field("subtotal", 100),
      grand_total: field("grand_total", 100),
    });
    expect(grandTotal.run(ctx)[0].result.outcome).toBe("pass");
  });

  it("does not silently assume zero for a genuinely missing discount", () => {
    const ctx = context({
      subtotal: field("subtotal", 100),
      discount: field("discount", null, { status: "missing" }),
      grand_total: field("grand_total", 100),
    });
    expect(grandTotal.run(ctx)[0].result.outcome).toBe("not_applicable");
  });

  it("fails and blocks export when the grand total doesn't reconcile", () => {
    const ctx = context({
      subtotal: field("subtotal", 100),
      discount: field("discount", 10),
      grand_total: field("grand_total", 500),
    });
    const [r] = grandTotal.run(ctx);
    expect(r.result.outcome).toBe("fail");
    expect(r.result.blocks_export).toBe(true);
  });
});
