# CLAUDE.md — Oravio M5 Document Intelligence

> **This app now lives at `apps/m5-documents` in the `github.com/oravio23/Modules` monorepo.**
> See this folder's README.md for what changed in that move (auth, tokens, DB schema, edge
> functions). Everything below describes the original standalone pilot and its governance
> status, which is still accurate as history — just read it with that context.

**Status of this document:** DRAFT. Supersedes the original handoff brief (delivered inside
`00_governance/`'s companion zip) now that a working implementation exists in this repository.
Phase 0 governance is still **not approved** — see Section 1 before treating anything here as
settled. This file is placed at the repo root so Claude Code reads it automatically.

---

## 1. Governance status — read this first

This project runs under the **Oravio M5 ORBIT-DI framework**. As of this repo's creation:

- **Phase 0 (governance) is still drafted, not approved.** The Charter, RACI, decision/risk/artifact
  register, and Task Protocol in `00_governance/` (delivered separately, not part of this repo) have
  no recorded APPROVE. Six of seven RACI seats are unnamed.
- **This repo is a working implementation of the bounded commercial-invoice slice, built generic
  enough to accept any file type.** It was built because the original handoff instructed
  implementation to proceed while explicitly flagging every place a real governance decision was
  still open — see Section 6.
- **The M5-specific specs this repo depends on were not supplied** when this repo was created:
  `M5-Result-Envelope-v0.1.json`, `M5-Validator-Catalogue-v0.1.yaml`, the Field Catalogue v0.3, PRD,
  UX contracts, and the 157-case spec test pack all live in the OneDrive M5 folder, not in the
  package this repo was built from. Every place this repo had to invent a substitute is marked
  **PROPOSED** in code and in `specs/*.json`, with a note on what it's standing in for. See Section 4.

**What this means for you as an implementer:** treat every PROPOSED artifact in this repo as a
well-sourced draft worth building against, not a ratified contract. When the real M5 artifacts
arrive, swap them in as data — the pipeline reads schemas/prompts/validator IDs from
`supabase/functions/_shared/profiles/*.ts` and `supabase/functions/_shared/validation/*.ts`, not
from anything hardcoded per-document-type, specifically so this swap doesn't require rewriting the
pipeline itself.

---

## 2. What this repo is

**One sentence:** an app that takes any uploaded file — native/scanned PDF, photo, spreadsheet,
Word doc, slide deck, email export, or zip of mixed documents, in English, Arabic, or mixed — and
produces a structured, schema-validated extraction with per-field evidence, confidence, and
explicit uncertainty, gated by mandatory human review before anything is exported.

**Two document profiles ship today** (see `supabase/functions/_shared/profiles/`):

- `generic` — no fixed field set; returns a document-type guess, summary, and whatever key-values
  the document actually contains. This is what makes "any document" true rather than
  "any document that happens to be an invoice."
- `commercial_invoice` — the bounded M5 slice: seller/buyer, invoice identifiers, line items,
  totals, Incoterms, payment/bank details. **PROPOSED**, derived from `CLAUDE.md` §2's bounded use
  case description in the absence of the real Field Catalogue v0.3.

Adding Bill of Lading, Packing List, or Certificate of Origin later is a new profile file plus
fixtures — not a pipeline change. That's the point of the profile abstraction.

**Client context (unchanged from the original handoff):** first pilot is KLS (Kabbani Logistics
Services), a Beirut customs brokerage, replacing manual re-entry into ASYCUDA — not the customs
filing itself.

**Still explicitly out of scope** (Charter §4, unchanged): HS/tariff classification, CIF/customs
valuation, ASYCUDA XML generation, Najm portal upload, production deployment, real client data,
multi-tenant operation.

---

## 3. Non-negotiable constraints — how this repo enforces them

These are architectural decisions, not just policy statements:

- **No unsupported critical output reaches a downstream system.** Every extracted field carries an
  evidence quote that is checked, deterministically, against the stored transcript — see
  `supabase/functions/_shared/validation/anchor.ts`. A quote that doesn't anchor cannot mark its
  field trustworthy; `EVD-001` fails and, for a profile-critical field, blocks export.
- **No real client data, ever, without explicit written authorization.** `fixtures/` is 100%
  synthetic/fictional — see `scripts/generate-fixtures.ts`'s header comment.
- **Deterministic validation runs independently of the model.** The entire validator catalogue
  (`supabase/functions/_shared/validation/*.ts`) is pure TypeScript with zero API calls — unit
  tested with no `ANTHROPIC_API_KEY` at all (`npm test`).
- **100% human review during the pilot.** `FieldResult.requires_review` is hardcoded `true` for
  every field in `envelope.ts`'s `buildEnvelope()` — not a threshold, not configurable. Export is
  blocked in the UI and in `export-result` until `extractions.review_state = 'approved'`, which only
  a human action in the Review page can set.

---

## 4. Source of truth — read these before changing code

| Read this first for... | File |
|---|---|
| **Output contract** | `specs/result-envelope-v0.1-PROPOSED.json` (JSON Schema 2020-12) + `supabase/functions/_shared/envelope-types.ts` (TS mirror) |
| **Deterministic validators** | `specs/validator-catalogue-v0.1-PROPOSED.json` (generated) + `supabase/functions/_shared/validation/*.ts` (actual logic) |
| Document profiles (field catalogues, extraction prompts) | `supabase/functions/_shared/profiles/{generic,commercial-invoice}.ts`, snapshots at `specs/profiles/*.json` |
| Database schema | `supabase/migrations/0001_init.sql` |
| Pipeline stage machine | `supabase/functions/_shared/pipeline/{stages,transcribe,classify,extract}.ts`, orchestrated by `supabase/functions/pipeline-worker/index.ts` |
| Upload flow | `src/lib/upload/uploadDocument.ts`, `supabase/functions/documents-register/index.ts` |
| Ingest / any-file-type normalisation | `src/lib/ingest/sniff.ts` + `src/lib/ingest/normalize/*.ts` |
| Review UI | `src/components/review/{ReviewWorkspace,PartViewer,FieldPanel,ValidationPanel}.tsx` |
| Export | `supabase/functions/export-result/index.ts` |
| Eval harness | `scripts/eval.ts` |
| Architecture decisions | `docs/adr/ADR-012-technology-stack.md`, `ADR-013-result-envelope-and-evidence-anchoring.md`, `ADR-014-json-schema-dialect.md` |
| Everything proposed-but-unratified, logged | `docs/decision-log-additions.md` (paste into the real Decision Log once Phase 0 has one) |

---

## 5. What does *not* exist yet — don't assume it does

- **No approved Field Catalogue, Result-Envelope schema, or Validator Catalogue.** This repo's
  versions are PROPOSED substitutes, clearly marked. Swap them for the real v0.1/v0.3 artifacts when
  available — the data-driven profile/validator design means that's a content swap, not a rewrite.
- **No real fixtures.** All 157 spec-level test cases referenced in the original handoff still don't
  exist as real annotated data; this repo's `fixtures/` are original synthetic scenarios built to
  exercise the pipeline (clean, conflicting-totals, missing-required-field, discount-flagged,
  Arabic/mixed), not a re-creation of that 157-case pack.
- **No benchmark has been run.** `scripts/eval.ts` reports field-level precision/recall, anchor
  rate, validator distribution, and cost — with **no invented pass/fail threshold** (Charter §5
  defers that to Phase 4/8). It requires a real `ANTHROPIC_API_KEY` and has not been run against the
  real Anthropic API as part of building this repo — only its wiring/imports were verified.
- **No live end-to-end run against a real Supabase project.** Docker wasn't available in the
  environment this was built in, so `supabase start` was never executed here. Every offline path
  (schema validation, validator catalogue, anchoring gate, ingest normalisers — 111 tests) is
  verified; the live pipeline (`documents-register` → `pipeline-worker` → Review UI, against a real
  Postgres/Storage/Realtime instance and a real Claude API key) is not. See Section 7.
- **No technology stack decision has been formally ratified** beyond what's logged as PROPOSED in
  ADR-012 — it was chosen to match what Lovable generates, so the app can be copied there directly.

---

## 6. Decisions made that no human has ratified yet

Logged in `docs/decision-log-additions.md` in the existing register's row format, status PROPOSED:

- **Architecture style**: modular monolith (Vite SPA + Supabase Edge Functions), not separate
  services. Matches ADR-001's "PROPOSED, not accepted" modular-monolith option.
- **JSON Schema dialect**: Draft 2020-12, confirming the prior PROPOSED choice in the Result-Envelope
  schema (ADR-014).
- **Technology stack**: Vite + React + TypeScript + Tailwind + shadcn/ui + Supabase (Postgres, Auth,
  Storage, Edge Functions, Realtime), chosen specifically to match Lovable's generated stack so this
  repo can be imported there directly for hosting (ADR-012).
- **Repository host / default branch / CI provider**: still not chosen — out of scope for this task.
- **Scope reconciliation**: the user asked for "any file type," which the existing bounded-invoice
  charter doesn't cover. Resolved as generic-engine-plus-profile (see Section 2) rather than picking
  one over the other — logged as a scope decision, not silently either narrowed or widened.

---

## 7. Working protocol for this repo

**Stale, like the rest of this file per the banner at the top — these are the original standalone
pilot's commands.** Actually use `pnpm --filter @oravio/m5-documents <script>` from the repo root
(`typecheck`, `test`, `build`, `lint`), or `pnpm --filter @oravio/shell dev` alongside it per
`CONTRIBUTING.md`. Kept below anyway since the `npm run <x>` script names themselves are unchanged.

- `npm install` (also copies pdf.js worker/fonts to `public/pdfjs/` via `postinstall`)
- `npm test` — 131 tests as of the monorepo move, no API key or network needed (schema, validators, anchoring gate, ingest
  normalisers, csv/xlsx writers)
- `npx tsc -b --noEmit` — frontend typecheck
- `deno check --config supabase/functions/deno.json supabase/functions/*/index.ts` — edge function
  typecheck (requires the Deno CLI; not required for Supabase to run the functions, only useful for
  catching type errors before deploying)
- `npm run dev` — frontend dev server (needs `.env.local` — see `.env.example`)
- `supabase start` — local Postgres/Storage/Realtime/Edge Functions (needs Docker running)
- `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...` — required before the pipeline can actually
  call Claude; never set as a `VITE_` variable or committed anywhere
- `npm run fixtures` — regenerate the synthetic fixture set
- `npm run specs` — regenerate `specs/*.json` snapshots + `supabase/seed.sql` from the canonical
  TypeScript profile/validator definitions after editing them
- `ANTHROPIC_API_KEY=... npm run eval` — run the eval harness against the fixture set

## 8. Suggested next steps for whoever picks this up

1. Get Docker running and `supabase start`, then run the full upload → pipeline → review → export
   flow against the synthetic fixtures end-to-end — this has not been exercised live yet (Section 5).
2. Run `npm run eval` with a real API key and read the numbers before touching any threshold logic —
   there isn't one yet, by design (Charter §5).
3. When the real M5-Result-Envelope schema, Validator Catalogue, and Field Catalogue arrive, replace
   the PROPOSED files listed in Section 4 and re-run `npm test` — the data-driven design means the
   pipeline code itself shouldn't need to change.
4. Name the six open RACI seats and resolve the two pending Executive Sponsor decisions (ratify vs.
   redo the prototype set; locate-or-correct the version-drift citations) — both still block Phase 0
   from formally closing, independent of this repo's existence.
