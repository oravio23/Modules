import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizePdf } from "./pdf.ts";

const fixture = path.resolve(__dirname, "../../../../fixtures/invoices/clean/document.pdf");

describe("normalizePdf", () => {
  it("reports the correct page count and extracts the native text layer", async () => {
    const bytes = new Uint8Array(readFileSync(fixture));
    const result = await normalizePdf({ filename: "document.pdf", bytes });
    expect(result.pdfPageCount).toBe(1);
    expect(result.parts).toHaveLength(1);
    expect(result.parts[0].kind).toBe("page");
    expect(result.parts[0].label).toBe("Page 1");
    expect(result.parts[0].text).toContain("INV-2026-0417");
    // No per-part bytes — the whole PDF is uploaded once at the pipeline layer, not split into page images here.
    expect(result.parts[0].bytes).toBeUndefined();
  });
});
