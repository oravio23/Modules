import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizePptx } from "./pptx.ts";

const fixture = path.resolve(__dirname, "../../../../fixtures/formats/sample.pptx");

describe("normalizePptx", () => {
  it("produces one part per slide, in slide order", async () => {
    const bytes = new Uint8Array(readFileSync(fixture));
    const result = await normalizePptx({ filename: "sample.pptx", bytes });
    expect(result.parts).toHaveLength(2);
    expect(result.parts[0].label).toBe("Slide 1");
    expect(result.parts[0].text).toContain("Title Slide");
    expect(result.parts[1].label).toBe("Slide 2");
    expect(result.parts[1].text).toContain("INV-2026-0417");
  });
});
