import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { detectType } from "./sniff.ts";

const fixturesDir = path.resolve(__dirname, "../../../fixtures/formats");

function load(name: string) {
  return { filename: name, bytes: new Uint8Array(readFileSync(path.join(fixturesDir, name))) };
}

describe("detectType — magic-byte detection over the real fixture set", () => {
  it("detects a PDF by magic bytes regardless of extension", () => {
    const detected = detectType(load("sample.pdf"));
    expect(detected.kind).toBe("pdf");
    expect(detected.method).toBe("magic");
  });

  it("detects PNG by magic bytes", () => {
    expect(detectType(load("sample.png")).kind).toBe("image/png");
  });

  it("detects docx (zip + word/document.xml) distinctly from a plain zip", () => {
    expect(detectType(load("sample.docx")).kind).toBe("docx");
  });

  it("detects xlsx (zip + xl/workbook.xml) distinctly from docx/pptx", () => {
    expect(detectType(load("sample.xlsx")).kind).toBe("xlsx");
  });

  it("detects pptx (zip + ppt/presentation.xml) distinctly from docx/xlsx", () => {
    expect(detectType(load("sample.pptx")).kind).toBe("pptx");
  });

  it("detects a plain zip that isn't any Office format", () => {
    expect(detectType(load("sample.zip")).kind).toBe("zip");
  });

  it("detects an .eml file by its header shape, not extension", () => {
    const eml = load("sample.eml");
    const detected = detectType({ filename: "no-extension-at-all", bytes: eml.bytes });
    expect(detected.kind).toBe("eml");
    expect(detected.method).toBe("heuristic");
  });

  it("falls back to extension only for text-shaped formats with no distinctive magic bytes", () => {
    expect(detectType(load("sample.md")).kind).toBe("text/markdown");
    expect(detectType(load("sample.csv")).kind).toBe("text/csv");
  });

  it("detects JSON content even without a .json extension, from shape alone", () => {
    const json = load("sample.json");
    const detected = detectType({ filename: "data", bytes: json.bytes });
    expect(detected.kind).toBe("application/json");
  });

  it("rejects genuinely unrecognisable binary as 'unknown', not as text", () => {
    const junk = new Uint8Array([0x00, 0xff, 0x13, 0x37, 0x00, 0xde, 0xad, 0xbe, 0xef, 0x00, 0x01, 0x02]);
    expect(detectType({ filename: "mystery.bin", bytes: junk }).kind).toBe("unknown");
  });

  it("a file whose extension lies about its content is sniffed by content, not trusted by extension", () => {
    const png = load("sample.png");
    const detected = detectType({ filename: "totally-a-document.pdf", bytes: png.bytes });
    expect(detected.kind).toBe("image/png");
  });
});
