import { describe, expect, it } from "vitest";
import { buildCsv } from "./csv-writer.ts";

describe("buildCsv", () => {
  it("joins plain cells with commas and CRLF row endings", () => {
    expect(buildCsv([["a", "b"], [1, 2]])).toBe("a,b\r\n1,2\r\n");
  });

  it("quotes cells containing commas, quotes, or newlines, doubling embedded quotes", () => {
    expect(buildCsv([["say \"hi\"", "a,b", "line1\nline2"]])).toBe('"say ""hi""","a,b","line1\nline2"\r\n');
  });

  it("renders null/undefined as an empty cell", () => {
    expect(buildCsv([[null, undefined, "x"]])).toBe(",,x\r\n");
  });
});
