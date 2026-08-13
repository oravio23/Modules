import type { PartKind } from "../parts.ts";

export type JobStage = "register" | "transcribe" | "classify" | "extract" | "anchor" | "validate" | "done";

export interface IncomingPartSummary {
  kind: PartKind;
}

/**
 * Decide which stage a freshly-registered document should start at.
 *
 * Sheet/slide/text parts already carry a ground-truth transcript from
 * client-side extraction (SheetJS/mammoth/fast-xml-parser) — there is
 * nothing ambiguous about a spreadsheet cell or a paragraph of decoded UTF-8
 * text, so asking Claude to "transcribe" it again would be a wasted,
 * costlier round trip. Only 'page' parts (PDF pages and standalone images)
 * lack an authoritative transcript and need the model to actually read them.
 *
 * This is what makes a plain XLSX/DOCX/PPTX/text/email document skip
 * straight to classification — cheaper and faster for the large share of
 * "any file type" that was never a scan or a photo in the first place.
 */
export function decideInitialStage(parts: IncomingPartSummary[]): JobStage {
  const needsTranscription = parts.some((p) => p.kind === "page");
  return needsTranscription ? "transcribe" : "classify";
}

export function nextStage(current: JobStage): JobStage {
  const order: JobStage[] = ["register", "transcribe", "classify", "extract", "anchor", "validate", "done"];
  const i = order.indexOf(current);
  return order[Math.min(i + 1, order.length - 1)];
}
