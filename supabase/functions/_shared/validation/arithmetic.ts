import type { ValidatorContext, ValidatorDefinition } from "./types.ts";
import { attach } from "./types.ts";

/** Tolerance for arithmetic checks: one minor currency unit (e.g. one cent). */
const TOLERANCE = 0.01;

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function extractedNumber(ctx: ValidatorContext, path: string): number | null {
  const field = ctx.fields[path];
  if (!field || field.status !== "extracted") return null;
  return num(field.value);
}

function lineItemIndices(ctx: ValidatorContext): number[] {
  const indices = new Set<number>();
  for (const path of Object.keys(ctx.fields)) {
    const m = /^line_items\[(\d+)\]\./.exec(path);
    if (m) indices.add(Number(m[1]));
  }
  return [...indices].sort((a, b) => a - b);
}

/** ARI-001 — each line item: quantity × unit_price ≈ line_total. */
const lineItemTotal: ValidatorDefinition = {
  id: "ARI-001",
  category: "ARI",
  title: "Line item arithmetic",
  description: "quantity × unit_price = line_total, within one minor currency unit.",
  run(ctx: ValidatorContext) {
    const out = [];
    for (const i of lineItemIndices(ctx)) {
      const path = `line_items[${i}].line_total`;
      const qty = extractedNumber(ctx, `line_items[${i}].quantity`);
      const price = extractedNumber(ctx, `line_items[${i}].unit_price`);
      const total = extractedNumber(ctx, path);
      if (qty === null || price === null || total === null) {
        out.push(attach(path, "ARI-001", "not_applicable", {
          message: "One or more of quantity/unit_price/line_total is missing or non-numeric.",
        }));
        continue;
      }
      const expected = qty * price;
      const ok = Math.abs(expected - total) <= TOLERANCE;
      out.push(
        attach(path, "ARI-001", ok ? "pass" : "fail", {
          message: ok ? null : `Expected ${expected.toFixed(2)} (${qty} × ${price}), found ${total}.`,
          blocks_export: !ok,
        }),
      );
    }
    return out;
  },
};

/** ARI-002 — sum of line item totals ≈ subtotal. */
const subtotalSum: ValidatorDefinition = {
  id: "ARI-002",
  category: "ARI",
  title: "Subtotal arithmetic",
  description: "Sum of line_items[*].line_total = subtotal, within one minor currency unit.",
  run(ctx: ValidatorContext) {
    const indices = lineItemIndices(ctx);
    if (indices.length === 0) return [];
    const totals = indices.map((i) => extractedNumber(ctx, `line_items[${i}].line_total`));
    const subtotal = extractedNumber(ctx, "subtotal");
    if (totals.some((t) => t === null) || subtotal === null) {
      return ctx.fields["subtotal"]
        ? [attach("subtotal", "ARI-002", "not_applicable", {
            message: "Not every line_total is present and numeric, or subtotal is missing.",
          })]
        : [];
    }
    const sum = (totals as number[]).reduce((a, b) => a + b, 0);
    const ok = Math.abs(sum - subtotal) <= TOLERANCE;
    return [
      attach("subtotal", "ARI-002", ok ? "pass" : "fail", {
        message: ok ? null : `Line items sum to ${sum.toFixed(2)}, but subtotal reads ${subtotal}.`,
        blocks_export: !ok,
      }),
    ];
  },
};

/** ARI-003 — subtotal − discount + tax + freight + insurance ≈ grand_total. */
const grandTotal: ValidatorDefinition = {
  id: "ARI-003",
  category: "ARI",
  title: "Grand total arithmetic",
  description: "subtotal − discount + tax + freight + insurance = grand_total, within one minor currency unit.",
  run(ctx: ValidatorContext) {
    if (!ctx.fields["grand_total"]) return [];
    const subtotal = extractedNumber(ctx, "subtotal");
    const grand = extractedNumber(ctx, "grand_total");
    // Adjustment fields default to 0 ONLY when explicitly extracted-and-zero
    // or genuinely not part of this profile; a 'missing' status on a field
    // that exists in the schema makes the whole check not_applicable rather
    // than silently treating an unknown discount as zero.
    const adjustmentPaths = ["discount", "tax", "freight", "insurance"];
    const adjustments: number[] = [];
    for (const p of adjustmentPaths) {
      const f = ctx.fields[p];
      if (!f) continue; // not part of this profile at all — fine, treat as 0
      if (f.status === "not_applicable") continue; // explicitly n/a — fine, treat as 0
      const v = num(f.value);
      if (f.status !== "extracted" || v === null) {
        return [
          attach("grand_total", "ARI-003", "not_applicable", {
            message: `Cannot verify: "${p}" is not a confirmed numeric value.`,
          }),
        ];
      }
      adjustments.push(p === "discount" ? -v : v);
    }
    if (subtotal === null || grand === null) {
      return [
        attach("grand_total", "ARI-003", "not_applicable", {
          message: "subtotal or grand_total is missing or non-numeric.",
        }),
      ];
    }
    const expected = subtotal + adjustments.reduce((a, b) => a + b, 0);
    const ok = Math.abs(expected - grand) <= TOLERANCE;
    return [
      attach("grand_total", "ARI-003", ok ? "pass" : "fail", {
        message: ok ? null : `Expected ${expected.toFixed(2)}, found ${grand}.`,
        blocks_export: !ok,
      }),
    ];
  },
};

export const ARITHMETIC_VALIDATORS: ValidatorDefinition[] = [lineItemTotal, subtotalSum, grandTotal];
