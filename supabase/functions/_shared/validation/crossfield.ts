import type { ValidatorContext, ValidatorDefinition } from "./types.ts";
import { attach } from "./types.ts";
import { isValidIsoDate } from "./format.ts";

/** XFD-001 — invoice_date is not in the future. */
const invoiceDateNotFuture: ValidatorDefinition = {
  id: "XFD-001",
  category: "XFD",
  title: "Invoice date not in the future",
  description: "invoice_date is on or before the date of processing.",
  run(ctx: ValidatorContext) {
    const field = ctx.fields["invoice_date"];
    if (!field || field.status !== "extracted" || typeof field.value !== "string") return [];
    if (!isValidIsoDate(field.value)) return []; // FMT-DATE-001 already reports the format problem
    const invoiceDate = new Date(`${field.value}T00:00:00Z`);
    const today = new Date(Date.UTC(ctx.now.getUTCFullYear(), ctx.now.getUTCMonth(), ctx.now.getUTCDate()));
    const ok = invoiceDate.getTime() <= today.getTime();
    return [
      attach("invoice_date", "XFD-001", ok ? "pass" : "fail", {
        message: ok ? null : `Invoice date ${field.value} is after today (${today.toISOString().slice(0, 10)}).`,
      }),
    ];
  },
};

/** XFD-002 — monetary fields are non-negative (a negative subtotal/tax/etc. is almost always a transcription error, not a real value). */
const MONETARY_FIELDS = ["subtotal", "discount", "freight", "insurance", "tax", "grand_total"];
const monetaryNonNegative: ValidatorDefinition = {
  id: "XFD-002",
  category: "XFD",
  title: "Monetary fields non-negative",
  description: "subtotal/discount/freight/insurance/tax/grand_total are all >= 0.",
  run(ctx: ValidatorContext) {
    const out = [];
    for (const path of MONETARY_FIELDS) {
      const field = ctx.fields[path];
      if (!field || field.status !== "extracted") continue;
      const v = typeof field.value === "number" ? field.value : Number(field.value);
      if (!Number.isFinite(v)) continue;
      const ok = v >= 0;
      if (!ok) {
        out.push(attach(path, "XFD-002", "fail", { message: `${path} is negative (${v}).` }));
      } else {
        out.push(attach(path, "XFD-002", "pass"));
      }
    }
    return out;
  },
};

/** XFD-003 — seller and buyer are not the same party. */
const sellerNotBuyer: ValidatorDefinition = {
  id: "XFD-003",
  category: "XFD",
  title: "Seller distinct from buyer",
  description: "seller_name and buyer_name, normalised, are not identical.",
  run(ctx: ValidatorContext) {
    const seller = ctx.fields["seller_name"];
    const buyer = ctx.fields["buyer_name"];
    if (!seller || !buyer) return [];
    if (seller.status !== "extracted" || buyer.status !== "extracted") return [];
    if (typeof seller.value !== "string" || typeof buyer.value !== "string") return [];
    const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
    const ok = norm(seller.value) !== norm(buyer.value);
    return [
      attach("buyer_name", "XFD-003", ok ? "pass" : "fail", {
        message: ok ? null : "Seller and buyer names are identical — likely an extraction error.",
      }),
    ];
  },
};

export const CROSSFIELD_VALIDATORS: ValidatorDefinition[] = [
  invoiceDateNotFuture,
  monetaryNonNegative,
  sellerNotBuyer,
];
