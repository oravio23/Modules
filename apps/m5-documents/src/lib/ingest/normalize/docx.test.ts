import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeDocx } from "./docx.ts";

const fixture = path.resolve(__dirname, "../../../../fixtures/formats/sample.docx");

describe("normalizeDocx", () => {
  it("extracts the document body as one text part", async () => {
    const bytes = new Uint8Array(readFileSync(fixture));
    const result = await normalizeDocx({ filename: "sample.docx", bytes });
    expect(result.parts).toHaveLength(1);
    expect(result.parts[0].kind).toBe("text");
    expect(result.parts[0].text).toContain("INV-2026-0417");
    expect(result.parts[0].text).toContain("Sample Word Document");
  });
});
