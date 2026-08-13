import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeFileLike } from "./index.ts";

const fixture = path.resolve(__dirname, "../../../../fixtures/formats/sample.zip");

describe("normalizeZip (via normalizeFileLike recursion)", () => {
  it("recurses into every entry and flattens their parts, labelled with the entry name", async () => {
    const bytes = new Uint8Array(readFileSync(fixture));
    const result = await normalizeFileLike({ filename: "sample.zip", bytes });

    // sample.zip contains: readme.txt (1 text part), invoice.pdf (1+ page parts), notes.txt (1 text part)
    const labels = result.parts.map((p) => p.label);
    expect(labels.some((l) => l.includes("readme.txt"))).toBe(true);
    expect(labels.some((l) => l.includes("invoice.pdf"))).toBe(true);
    expect(labels.some((l) => l.includes("notes.txt"))).toBe(true);

    const invoicePagePart = result.parts.find((p) => p.label.includes("invoice.pdf"));
    expect(invoicePagePart?.text).toContain("INV-2026-0417");
  });
});
