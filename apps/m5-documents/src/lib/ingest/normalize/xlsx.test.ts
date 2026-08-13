import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeXlsx } from "./xlsx.ts";

const fixture = path.resolve(__dirname, "../../../../fixtures/formats/sample.xlsx");

describe("normalizeXlsx", () => {
  it("produces one part per sheet, rendered as a markdown table", async () => {
    const bytes = new Uint8Array(readFileSync(fixture));
    const result = await normalizeXlsx({ filename: "sample.xlsx", bytes });
    expect(result.parts).toHaveLength(1);
    expect(result.parts[0].kind).toBe("sheet");
    expect(result.parts[0].label).toContain("Invoice");
    expect(result.parts[0].text).toContain("INV-2026-0417");
    expect(result.parts[0].text).toContain("|"); // markdown table pipes
  });
});
