# ADR-014 — JSON Schema Dialect

**Status:** PROPOSED — confirms prior Decision D-005, still awaiting Phase 0 gate and Engineering
Lead sign-off (seat unnamed).
**Date:** 2026-08-06
**Relates to:** Decision D-005 (logged retroactively in the delivered `decision-risk-artifact-register.xlsx`
as "JSON Schema Draft 2020-12 selected... PROPOSED Phase 6 convention because no dialect was fixed by
Phase 5"), Task Protocol §1 ("[OPEN]... repository host... and initial technology stack are not yet
selected" — the schema-dialect question is the same category of not-yet-ratified convention).

## Context

The prototype-era `M5-Result-Envelope-v0.1.json` (not supplied in this repo's source package —
see CLAUDE.md §1/§5) reportedly already proposed Draft 2020-12 as its dialect, per the register's
retroactive Decision D-005 entry. This repo needed to pick an actual dialect to write
`specs/result-envelope-v0.1-PROPOSED.json` and validate against it at runtime (via ajv) — so this
ADR either confirms that prior choice explicitly (if the retroactive log is accurate) or, if the
real file differs when it becomes available, flags the discrepancy for reconciliation rather than
silently diverging.

## Decision

Use **JSON Schema Draft 2020-12** for `specs/result-envelope-v0.1-PROPOSED.json`, validated at
runtime via `ajv`'s `Ajv2020` build (`supabase/functions/_shared/envelope.ts`).

Practical reason this dialect specifically: 2020-12 is the current, actively-maintained draft with
the clearest `$defs`/`$ref` semantics for a schema with several reused sub-shapes (`Evidence`,
`ValidatorResult`, `FieldResult` all reference each other) — older drafts (07, 2019-09) work too, but
2020-12 is what `ajv` and most current tooling document as the target dialect going forward.

## Consequences

- Every consumer of the envelope schema — the `ajv` compile step, the `scripts/export-specs.ts`
  snapshot generator, and any future non-TypeScript tooling — must use a 2020-12-capable validator.
  `ajv`'s default export only ships the Draft-07 meta-schema; this repo explicitly imports the
  `Ajv2020` build (`ajv/dist/2020.js`) rather than the default, and that import needed an explicit
  `.js` extension to resolve correctly under both Node and the Deno edge runtime (documented inline
  in `envelope.ts`).
- If the real M5-Result-Envelope-v0.1.json turns out to target a different dialect when it's
  supplied, that's a direct conflict with this ADR and with D-005's retroactive log entry — worth
  flagging to the Executive Sponsor / Engineering Lead rather than silently reconciling one way or
  the other.

## Alternatives considered

- **Draft-07** — rejected: it's `ajv`'s default without extra imports, which was tempting for
  simplicity, but it's a materially older dialect and D-005 already proposed 2020-12 for this exact
  artifact.
- **No formal JSON Schema at all** (validate with hand-written TypeScript checks only) — rejected:
  a real schema file is independently readable by a human reviewer or a non-TypeScript tool, and
  `ajv`'s validation is what the offline test suite (`envelope.test.ts`) checks against — hand-written
  checks would just be a parallel, harder-to-audit reimplementation of the same rules.
