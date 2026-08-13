import { describe, expect, it } from "vitest";
import { normalizeText } from "./text.ts";

describe("normalizeText", () => {
  it("decodes UTF-8 bytes into a single text part", async () => {
    const result = normalizeText({ filename: "note.txt", bytes: new TextEncoder().encode("Total: 92.00 USD") });
    expect(result.parts).toHaveLength(1);
    expect(result.parts[0].kind).toBe("text");
    expect(result.parts[0].text).toBe("Total: 92.00 USD");
  });

  it("suggests rtl direction for Arabic content", () => {
    const result = normalizeText({ filename: "note.txt", bytes: new TextEncoder().encode("مرحبا بالعالم") });
    expect(result.parts[0].direction).toBe("rtl");
  });
});
