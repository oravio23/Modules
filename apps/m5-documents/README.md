# Oravio M5 — Document Intelligence

> **Now part of the `github.com/oravio23/Modules` monorepo**, as `apps/m5-documents`. This was
> originally a standalone repo; the content below (and in CLAUDE.md) describes that original
> pilot and is kept as historical context. What's actually changed in the move:
> - Auth is real SSO now (`AuthProvider`/`ProtectedRoute`/`RequireModule`), not
>   `ensureAnonymousSession()` — see `src/lib/auth/` (vendored from `packages/auth`).
> - Design tokens are the real oravio.co brand tokens (`packages/tokens`), not this app's
>   original hand-authored HSL palette — see `src/index.css` (generated, do not hand-edit).
> - Database tables moved from `public` to schema `m5` in the shared platform database, with
>   `org_id` added alongside `owner_id` and RLS gated by `platform.has_module(auth.uid(), 'm5')`
>   — see `supabase/migrations/0003_m5_documents.sql` at the repo root, not inside this folder.
> - Edge functions moved to the shared `supabase/functions/` at the repo root.
>
> `npm install`/`supabase start` below refer to the original standalone setup — see
> `CONTRIBUTING.md` at the repo root for how local dev actually works now.

Uploads any file (native/scanned PDF, photo, spreadsheet, Word doc, slide deck, email export, or a zip
of mixed documents; English, Arabic, or mixed) and produces a structured, schema-validated extraction
with per-field evidence, confidence, and explicit uncertainty — gated by mandatory human review before
anything is exported.

Frontend: Vite + React + TypeScript + Tailwind + shadcn/ui. Backend: Supabase (Postgres, Storage, Auth,
Edge Functions, Realtime). Model calls (Claude Opus 5) happen only from Edge Functions.

**Start here:**
- [CLAUDE.md](CLAUDE.md) — governance status, what's PROPOSED vs ratified, architecture, and where
  everything lives.
- [docs/lovable-handoff-runbook.md](docs/lovable-handoff-runbook.md) — step-by-step guide for hosting
  this on Lovable + a real Supabase Cloud project.

**Local development:**
```bash
npm install          # also stages pdf.js assets into public/pdfjs/
cp .env.example .env.local   # fill in from `supabase status` after `supabase start`
supabase start        # local Postgres/Storage/Realtime/Edge Functions (needs Docker running)
npm run dev
```

**Tests** (no API key or network needed — schema, validators, anchoring, ingest normalisers):
```bash
npm test
```
