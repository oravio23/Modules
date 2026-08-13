# ADR-013 — Result Envelope Shape and the Evidence-Anchoring Gate

**Status:** PROPOSED — awaiting Phase 0 gate, Engineering Lead, and Domain Reviewer sign-off (both
seats unnamed). Supersedes nothing; the real `M5-Result-Envelope-v0.1.json` was not supplied in the
delivered governance package (see CLAUDE.md §1/§5) — this ADR documents the substitute this repo
built and why, so it can be evaluated and replaced cleanly.
**Date:** 2026-08-06
**Relates to:** Charter §5 core policy ("no unsupported or unverified critical output may silently
enter... downstream system"), Task Protocol §7 ("Deterministic validation is separate from the
model"), Decision D-004 (requires_review is a boolean, not a sixth status value).

## Context

The Charter's core policy requires that every extracted critical field carry verifiable evidence or
be explicitly marked missing/uncertain/conflicting — never a silently invented value — and that
validation run independently of whatever model does the extracting. Building this into working code
(rather than leaving it as a prompt instruction the model might not follow) requires an actual
mechanism, not just a schema field named `evidence`.

Claude's native `citations` feature was considered and rejected for this purpose: per the Claude API
skill reference, `citations` is incompatible with `output_config.format` (structured outputs) —
returns a 400 — and this pipeline needs structured, strict-tool-use output for every field
simultaneously with evidence. Citations also depend on the model's own citation mechanism being
reliable, which is exactly the trust this pipeline is designed not to place in the model alone.

## Decision

1. **Flat field map.** The envelope's `fields` property is `Record<field_path, FieldResult>` — not a
   nested tree — so a scalar field (`grand_total`) and a repeating-group field
   (`line_items[2].unit_price`) live at the same level, keyed by path string. This maps directly onto
   the `field_results` database table (one row per path) and onto the review UI (one card per field).
2. **Deterministic evidence anchoring, not model-reported citations.** Every field's evidence is a
   `{part_ordinal, quote}` pair the model provides. Before that evidence is trusted, it is checked —
   in pure TypeScript, no API call — against the transcript already stored for that part
   (`supabase/functions/_shared/validation/anchor.ts`). Two passes: exact substring match (gives real
   character offsets), then a match-normalised fallback (whitespace/case/Arabic-diacritic/Arabic-Indic-
   numeral folding) that verifies content without offsets. Neither match → `anchor: "unverified"`.
3. **`requires_review` is unconditionally `true`, separate from `status`.** Per Decision D-004,
   status is a five-value enum (`extracted | missing | uncertain | conflicting | not_applicable`)
   and `requires_review` is a boolean that never becomes a sixth status value. This repo hardcodes it
   `true` for every field during the pilot (Charter §5's mandatory-100%-human-review policy) rather
   than computing it from confidence or anchor state — anchor/validator outcomes still drive *export
   blocking* and review-queue prioritisation, but never suppress the review requirement itself.
4. **`EVD-001` is the enforcement point.** A field with `status: "extracted"` and zero verified-anchor
   evidence is a validator failure: `fail` + `blocks_export: true` if the field is profile-critical,
   `warn` otherwise. This is what makes anchoring load-bearing rather than informational.

## Consequences

- A hallucinated value cannot produce a quote that exists in the stored transcript, so it cannot
  anchor, so it cannot silently reach export for a critical field. This is enforced by a pure
  function with no model dependency — unit-tested directly (`anchor.test.ts`, `envelope.test.ts`)
  without an API key.
- Arabic and mixed-script documents get the same guarantee: the normalisation pass folds Arabic-Indic
  numerals and diacritics before comparing, so a model that transcribes digits differently than the
  stored transcript still anchors correctly (see `supabase/functions/_shared/arabic.ts`).
- Cost: two evidence-matching passes per field, entirely local and sub-millisecond — negligible next
  to the model call that produced the field in the first place.
- This envelope shape is a **substitute** for the real M5-Result-Envelope-v0.1.json. If the real
  schema differs in field names or structure, `supabase/functions/_shared/envelope-types.ts` and
  `specs/result-envelope-v0.1-PROPOSED.json` are the two files to reconcile against it; the anchoring
  mechanism itself (the actual safety property) should carry over regardless of exact field naming.

## Alternatives considered

- **Trust Claude's own confidence score as the sole gate** — rejected: confidence is a model's
  self-assessment, not an independently checkable fact. It's kept (`FieldResult.confidence`) as
  informational context for reviewers, not as a substitute for anchoring.
- **Native `citations` API** — rejected: incompatible with the structured-output tool use this
  pipeline needs (see Context), and still ultimately "trust what the model says it cited" rather than
  an independent check against stored data.
- **Nested per-document-type envelope shapes** (a different structure for invoices vs. generic docs)
  — rejected: the flat field-map shape is identical across every profile, which is what lets the
  same validator runner, anchoring gate, and review UI work for both `generic` and
  `commercial_invoice` (and any future profile) without per-type branching.
