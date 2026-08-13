import { normalizeForMatch } from "../arabic.ts";
import type { AnchorState, Evidence, EvidenceDraft, FieldResultDraft, PartTranscript } from "../envelope-types.ts";
import type { AnchoredField } from "./types.ts";

/**
 * The evidence-anchoring gate.
 *
 * This is the mechanism that makes "never silently invent a value"
 * enforceable rather than aspirational: a model-emitted evidence quote is
 * only trusted if it can be found, deterministically, in the transcript we
 * already stored for that part. No API call, no model involved — a
 * fabricated quote cannot pass this check no matter how confident the model
 * claims to be.
 *
 * Two passes are tried, in order:
 *   1. Exact substring match against the raw stored transcript — gives real
 *      character offsets for the review-pane highlight.
 *   2. Match-normalised substring (whitespace collapsed, Arabic diacritics
 *      and Arabic-Indic numerals folded, case-insensitive) — catches the
 *      common case where the model transcribed correctly but re-rendered
 *      digits or added/lost a diacritic. Offsets are null here: they'd point
 *      into normalised text, not the original, and a null offset is honest
 *      about that rather than silently wrong.
 *   Neither match -> 'unverified'. The field this evidence belongs to is
 *   then forced into review by the pipeline layer that calls this (see
 *   envelope.ts), and EVD-* validators will fail/block export on it.
 */
export function anchorEvidenceItem(draft: EvidenceDraft, transcripts: readonly PartTranscript[]): Evidence {
  const transcript = transcripts.find((t) => t.part_ordinal === draft.part_ordinal);
  if (!transcript) {
    return {
      part_ordinal: draft.part_ordinal,
      quote: draft.quote,
      char_start: null,
      char_end: null,
      anchor: "unverified",
    };
  }

  const exactIndex = transcript.text.indexOf(draft.quote);
  if (exactIndex !== -1) {
    return {
      part_ordinal: draft.part_ordinal,
      quote: draft.quote,
      char_start: exactIndex,
      char_end: exactIndex + draft.quote.length,
      anchor: "verified",
    };
  }

  const normalizedTranscript = normalizeForMatch(transcript.text);
  const normalizedQuote = normalizeForMatch(draft.quote);
  const fuzzyFound = normalizedQuote.length > 0 && normalizedTranscript.includes(normalizedQuote);

  const anchor: AnchorState = fuzzyFound ? "verified" : "unverified";
  return {
    part_ordinal: draft.part_ordinal,
    quote: draft.quote,
    char_start: null,
    char_end: null,
    anchor,
  };
}

/** Anchor every evidence item on one field draft. */
export function anchorField(draft: FieldResultDraft, transcripts: readonly PartTranscript[]): AnchoredField {
  const evidence = draft.evidence.map((item) => anchorEvidenceItem(item, transcripts));
  return {
    field_path: draft.field_path,
    field_label: draft.field_label,
    value: draft.value,
    status: draft.status,
    confidence: draft.confidence,
    evidence,
  };
}

/** Anchor a whole extraction's worth of field drafts against its transcripts. */
export function anchorFields(
  drafts: Record<string, FieldResultDraft>,
  transcripts: readonly PartTranscript[],
): Record<string, AnchoredField> {
  const out: Record<string, AnchoredField> = {};
  for (const [path, draft] of Object.entries(drafts)) {
    out[path] = anchorField(draft, transcripts);
  }
  return out;
}

/** True if a field has at least one verified-anchor evidence item. */
export function hasVerifiedEvidence(field: Pick<AnchoredField, "evidence">): boolean {
  return field.evidence.some((e) => e.anchor === "verified");
}
