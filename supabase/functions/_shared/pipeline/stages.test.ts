import { describe, expect, it } from "vitest";
import { decideInitialStage, nextStage } from "./stages.ts";

describe("decideInitialStage", () => {
  it("routes straight to classify when every part already has a ground-truth transcript (xlsx/docx/pptx/text/email)", () => {
    expect(decideInitialStage([{ kind: "sheet" }, { kind: "sheet" }])).toBe("classify");
    expect(decideInitialStage([{ kind: "text" }])).toBe("classify");
    expect(decideInitialStage([{ kind: "slide" }, { kind: "slide" }])).toBe("classify");
  });

  it("routes to transcribe when any part is a page (PDF page or standalone image) needing the model to actually read it", () => {
    expect(decideInitialStage([{ kind: "page" }])).toBe("transcribe");
    expect(decideInitialStage([{ kind: "text" }, { kind: "page" }])).toBe("transcribe");
  });
});

describe("nextStage", () => {
  it("walks the fixed stage order", () => {
    expect(nextStage("register")).toBe("transcribe");
    expect(nextStage("transcribe")).toBe("classify");
    expect(nextStage("classify")).toBe("extract");
    expect(nextStage("extract")).toBe("anchor");
    expect(nextStage("anchor")).toBe("validate");
    expect(nextStage("validate")).toBe("done");
  });

  it("stays at 'done' once reached", () => {
    expect(nextStage("done")).toBe("done");
  });
});
