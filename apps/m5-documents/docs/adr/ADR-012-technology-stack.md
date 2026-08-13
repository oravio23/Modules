# ADR-012 — Technology Stack

**Status:** PROPOSED — awaiting Phase 0 gate and Engineering Lead sign-off (RACI seat unnamed).
**Date:** 2026-08-06
**Relates to:** ADR-001 (architecture style, PROPOSED "modular monolith" option), CLAUDE.md §6,
Task Protocol §1 ("[OPEN] Repository host... and initial technology stack are not yet selected").

## Context

`CLAUDE.md`'s original handoff explicitly deferred the technology stack decision: the Workflow
Specification's tech notes (Claude API, Cohere embeddings, Supabase/pgvector, React/Vite) describe
the *existing* customs-agent product, not a confirmed choice for M5. The task brief instructed
whoever picks up implementation to propose a stack explicitly rather than silently treat one as
settled.

Separately, the user requested that this app be "coded in a way that I can migrate it directly to
Lovable for easy hosting" — a concrete, checkable constraint: Lovable generates a specific,
consistent stack (Vite + React + TypeScript + Tailwind + shadcn/ui + React Router, backed by
Supabase for Postgres/Auth/Storage/Edge Functions).

## Decision

Adopt exactly the stack Lovable generates, rather than picking independently and hoping it's
compatible:

- **Frontend:** Vite + React 18 + TypeScript + Tailwind (HSL CSS-variable tokens) + shadcn/ui
  (Radix primitives + `class-variance-authority`) + React Router v6 + TanStack Query.
- **Backend:** Supabase — Postgres (with RLS on every table), Storage (private bucket), Auth
  (anonymous sessions for the pilot — no login flow requested), Edge Functions (Deno), Realtime
  (for live pipeline-stage progress in the UI).
- **Model:** Claude Opus 5 (`claude-opus-5`) via the Anthropic TypeScript SDK, called only from Edge
  Functions — `ANTHROPIC_API_KEY` lives in Supabase function secrets, never in frontend code or a
  `VITE_` variable.

This satisfies ADR-001's still-PROPOSED "modular monolith" option (a Vite SPA + a set of Edge
Functions sharing one Postgres database, not separately deployed services) — this ADR treats that
choice as adopted for the reasons above, but it remains PROPOSED pending the same sign-off ADR-001
itself is still waiting on.

## Consequences

- Migrating this repo into Lovable should be close to a direct copy: same directory shape
  (`src/`, `supabase/functions/<name>/index.ts`, `supabase/migrations/*.sql`), same component
  library, same backend primitives.
- Constraints this locks in: no Next.js/SSR/API routes in `src/`; no Node-only APIs (`fs`, `path`,
  `Buffer`) in browser code; Edge Functions import via `npm:`/`jsr:` specifiers (see
  `supabase/functions/deno.json`), never a `node_modules` dependency.
- Heavy per-file-type parsers (`pdfjs-dist`, `mammoth`, `xlsx`, `heic-to`, `utif2`) are dynamically
  `import()`-ed only when a file of that type is actually detected (see
  `src/lib/ingest/normalize/index.ts`), keeping the initial bundle small.

## Alternatives considered

- **Next.js** — rejected: SSR/API-route model doesn't match Lovable's generated shape, and this
  app has no need for server rendering (everything after auth is a client-fetched dashboard).
- **A separate backend service (Express/Fastify/etc.)** — rejected: adds a deployment target
  Lovable can't host, and Supabase Edge Functions already cover everything the pipeline needs
  (server-side Anthropic calls, Postgres access, Storage).
- **A different component library (MUI, Chakra)** — rejected: Lovable's visual editor specifically
  operates on shadcn/ui + Tailwind semantic tokens; a different library would make the "migrate
  directly" requirement much weaker.
