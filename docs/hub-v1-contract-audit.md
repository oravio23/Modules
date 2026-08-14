# Hub V1 Foundation audit — implementation vs. contract

| | |
|---|---|
| **Date** | 2026-08-14 |
| **Repo / branch** | `oravio-modules` — audited at `main` @ `c56c29f` (*Fix upload failure: grant service_role access to platform and m1..m6*), clean tree |
| **Also referenced** | The pre-migration standalone M5 repo, `master` @ `1f56962`, now vendored as `apps/m5-documents` (migrated in `02aab6b`) |
| **Verified by** | `pnpm -r test` (111 tests at audit time), `pnpm -r typecheck`, `pnpm -r build` — all green |
| **Not verified** | Anything requiring a running Postgres or a hosted Supabase project. See [§8](#8-what-is-not-verified). |

---

## 1. Scope caveat — read this first

**The Hub V1 Foundation Contract Pack v1.1 was not available when this audit was performed.** It is
not in this repo, not in the M5 repo, and not anywhere under the auditing user's profile; it was
searched for by filename and by content. This audit is therefore **not a clause-by-clause conformance
check against v1.1**, and no statement below should be read as one.

What it *is*: an audit against the seven requirement areas named in the audit request, using the
closest in-repo restatement of the contract as the requirement source —

- [`CONTRIBUTING.md`](../CONTRIBUTING.md)'s "The module contract", rules 1–8
- the design commentary in [`0001_platform_core.sql`](../supabase/migrations/0001_platform_core.sql),
  particularly its three-layer enforcement statement (hub UI = UX; `platform.has_module()` in RLS and
  `requireModule()` in edge functions = the actual boundary)

**When the pack arrives, re-run this audit against the real clause list.** Areas marked Complete here
are complete against the seven named areas, which is a weaker claim.

---

## 2. Summary

| # | Area | Status |
|---|---|---|
| 1 | Authentication | **Partial** — code complete; OAuth providers and email confirmation unconfigured |
| 2 | Tenant isolation | **Partial** — the one open hole is now fixed; two design gaps remain |
| 3 | Database security | **Partial** — RLS thorough; zero database-level tests, never applied to a hosted project |
| 4 | Server-side module access | **Partial** — 2 of 3 edge functions gated; `pipeline-worker` ungated |
| 5 | User roles | **Missing** — column exists, enforced nowhere |
| 6 | Module registration | **Complete**, with one stale fallback list |
| 7 | M5 integration | **Complete** functionally, **never run end-to-end** |

---

## 3. Authentication — Partial

**Present.** One Supabase project serves every module, so there is exactly one `auth.users` table and
one JWT issuer — single sign-on is structural rather than bolted on
([`config.toml`](../supabase/config.toml)). One subscribed session shared app-wide via
[`AuthProvider.tsx`](../packages/auth/src/lib/auth/AuthProvider.tsx); one client factory at
[`client.ts:19`](../packages/auth/src/integrations/supabase/client.ts:19), and no app instantiates its
own — contract rule 6 holds. [`ProtectedRoute.tsx`](../packages/auth/src/lib/auth/ProtectedRoute.tsx)
correctly treats `loading` as "unknown" rather than "signed out" (avoiding a login flash on refresh)
and de-nests the `next` param to prevent the exponential-URL regression fixed in `155f9d2`. Anonymous
sign-ins are off (`config.toml:30`), deliberately unlike M5's pilot, because an anonymous session can
never resolve to an org.

**Gaps.**

1. `LoginCard` calls `signInWithOAuth` for `google` and `azure`, and **neither provider is
   configured** — that is dashboard-only, per-project work. Both buttons currently fail with
   provider-not-enabled. See [`deploy-checklist.md` §3](deploy-checklist.md).
2. `enable_signup = true` with `enable_confirmations = false` (`config.toml:27,34`) means self-serve
   accounts on unverified email addresses. Combined with §7's missing org provisioning, a new signup
   reaches a permanently locked hub.

---

## 4. Tenant isolation — Partial

**Present.** `org_id` is the scoping column on every `m5` table, resolved through a `SECURITY DEFINER`
`platform.my_org_ids()` to sidestep the "infinite recursion detected in policy" failure that a
self-referential `org_members` policy would cause
([`0001_platform_core.sql:131-146`](../supabase/migrations/0001_platform_core.sql:131)). Storage keys
are org-scoped and the bucket policy checks `(storage.foldername(name))[1]` against membership
([`0003_m5_documents.sql:355-366`](../supabase/migrations/0003_m5_documents.sql:355)).

`export-result` is the reference implementation of the correct server-side pattern: it does **not**
treat `requireModule()` as authorisation for a specific row, but re-checks org membership for that
document, and returns 404 rather than 403 so it does not leak row existence
([`export-result/index.ts:61-67`](../supabase/functions/export-result/index.ts:61)).

**Fixed in this branch.** `documents-register` did not validate the client-supplied `storagePath`. It
resolved `orgId` from the caller's own membership, then passed the *request's* path straight to
`admin.storage.download()` — a `service_role` client, which has `BYPASSRLS` and is therefore not
constrained by the bucket policy that had governed the browser's upload. An authenticated user
entitled to `m5` could post another org's key and have the server fetch that file, forward it to the
Anthropic Files API, and register it as a document in their own org.

Now guarded by [`_shared/storage-paths.ts`](../supabase/functions/_shared/storage-paths.ts)
(`isOrgScopedPath`), applied to the original and every part before either service-role read. Coverage
was confirmed exhaustive: the only two service-role storage reads are `documents-register/index.ts:126`
and `:165`; `PartViewer.tsx` uses the anon client and is already covered by the bucket policy. 20 unit
tests in [`storage-paths.test.ts`](../supabase/functions/_shared/storage-paths.test.ts).

**Remaining gaps.**

1. **Non-deterministic org tie-break.** The client
   ([`org.ts`](../apps/m5-documents/src/lib/org.ts)) and the server
   (`documents-register/index.ts:52-59`) each independently pick "the" org with
   `ORDER BY created_at LIMIT 1`, over a table with **no unique constraint on `created_at`**. Two
   memberships created in one transaction share a timestamp; ordering among ties is unspecified, so
   the two can choose differently. The client then uploads to org A and the server rejects it with an
   unactionable 403 that no retry can clear. The new path guard makes this previously-silent
   inconsistency user-visible; it does not cause it. Fix by adding a deterministic tie-break on both
   sides, or by making the server authoritative over the path.
2. **`documents_org_update` restricts no columns**
   ([`0003:239`](../supabase/migrations/0003_m5_documents.sql:239)), so a browser client can set
   `documents.status` directly (e.g. to `exported`) or reassign `owner_id` within its own org.
3. The single-org assumption is hardcoded in both places above, while `has_module()` correctly ORs
   across every org the user belongs to — the two models disagree for a multi-org user.

---

## 5. Database security — Partial

**Present.** RLS is enabled on all 7 `platform` tables and all 8 `m5` tables. Every `m5` policy pairs
the org check **and** `platform.has_module(auth.uid(), 'm5')` — contract rule 3 satisfied without
exception ([`0003:211-333`](../supabase/migrations/0003_m5_documents.sql:211)). The
GRANT-is-checked-before-RLS relationship is handled and documented in both migrations.

[`0007_service_role_grants.sql`](../supabase/migrations/0007_service_role_grants.sql) is a good fix
and correctly generalised: it grants schema `USAGE` plus table/sequence/function privileges across
`platform` and `m1..m6`, and adds `ALTER DEFAULT PRIVILEGES` so the next five modules do not
rediscover `42501 permission denied for schema platform` the hard way. `anon` is deliberately granted
nothing beyond the `USAGE` it inherited from `0001`.

**Gaps.**

1. **No database-level tests exist.** Every passing test is pure TypeScript — validators, anchoring,
   envelope assembly, ingest normalisers, csv/xlsx writers, and now path scoping. **Nothing asserts
   the security boundary itself**: not `has_module()` resolution, not override-beats-plan, not the
   multi-org `bool_or` behaviour that
   [`0001:79-84`](../supabase/migrations/0001_platform_core.sql:79) explicitly reasons about, and not
   that RLS actually denies a foreign-org read. Given that RLS *is* the stated boundary, this is the
   highest-value missing coverage in the repo.
2. **No migration has been applied to a hosted project.** `[api].schemas` including `platform` is
   local-only and `supabase db push` does not carry it; if missed on cloud, every RPC 404s and the hub
   renders fully locked. Now at least surfaced by the banner at
   [`Hub.tsx:28-42`](../apps/shell/src/pages/Hub.tsx:28) rather than silently.
3. Minor: `0006_module_routes_trailing_slash.sql` is a no-op against `0001` as it now stands (`0001`
   already seeds `/m5/`), indicating `0001` was edited after `0006` was written. Harmless, but the two
   should be reconciled before anyone treats migration order as history.

---

## 6. Server-side module access — Partial

**Present.** [`requireModule()`](../supabase/functions/_shared/entitlements.ts) is well-built —
discriminated union rather than a nullable id, clean 401/403/500 separation — and is applied in
`documents-register/index.ts:30` and `export-result/index.ts:38`.

**Gaps.**

1. **`pipeline-worker` has no authentication check of any kind**, and `verify_jwt = false`
   (`config.toml:47-51`). Its entire input is a `jobId`
   ([`pipeline-worker/index.ts:37-38`](../supabase/functions/pipeline-worker/index.ts:37)). Anyone who
   can reach the URL with a valid job UUID can drive a pipeline run and spend Anthropic tokens. Job
   UUIDs are not guessable, so likelihood is low — but it is an unauthenticated, cost-incurring
   endpoint, and it contradicts contract rule 7. `requireModule()` is the wrong tool here (the caller
   is a service, not a user); this needs a shared-secret header.
2. **Fire-and-forget invocation may be dropped.**
   [`documents-register/index.ts:224`](../supabase/functions/documents-register/index.ts:224) calls
   `fetch(pipeline-worker)` without `await` and without `EdgeRuntime.waitUntil()`, then returns. With
   `[edge_runtime] policy = "oneshot"` the isolate is torn down at response time, so that request can
   be dropped — leaving the document at `status: 'queued'` forever with nothing in the logs. See
   [§9](#9-note-on-the-upload-failure).
3. `verify_jwt` settings in `config.toml` are local-only; deploying `pipeline-worker` to cloud
   requires `--no-verify-jwt`, which `deploy-checklist.md` does not mention.

---

## 7. User roles — Missing

`platform.org_members.role` exists with a four-value CHECK constraint
([`0001:28`](../supabase/migrations/0001_platform_core.sql:28)) and is selected for display at
[`Org.tsx:40`](../apps/shell/src/pages/Org.tsx:40). Grepping every migration, package and app, **that
is its only use.** No RLS policy and no edge function distinguishes `owner` from `admin` from `member`
from `viewer`.

The consequence worth escalating: `extractions_org_update`
([`0003:289-296`](../supabase/migrations/0003_m5_documents.sql:289)) lets **any** org member set
`review_state = 'approved'`, and that flag is the sole gate on export
([`export-result/index.ts:69-74`](../supabase/functions/export-result/index.ts:69)). So M5's mandatory
human-review control currently enforces "some human approved this", not "an authorised reviewer
approved this", with no separation between the person who uploaded a document and the person who
approves it. For a customs-brokerage pilot whose whole value proposition is trustworthy output, that
distinction is likely to matter to the client even though no contract clause was available to check it
against.

There is also no invite flow and no role-assignment path — see §8's provisioning gap.

---

## 8. Module registration — Complete

`platform.modules` with a six-row seed matching oravio.co's copy; `my_modules()` returning **all six**
with per-user grant state so locked modules stay discoverable rather than hidden; `plans`,
`plan_modules`, and `org_module_overrides` with override-beats-plan resolution and a correct multi-org
`bool_or` ([`0001:85-129`](../supabase/migrations/0001_platform_core.sql:85) — the comment there shows
the naive `LIMIT 1` bug was consciously avoided).

Supporting scaffolding is all present: pre-created `m1..m6` schemas
([`0002`](../supabase/migrations/0002_module_schemas.sql)), a template migration carrying the required
RLS pattern, the `apps/_template` app, `scripts/sync-ui.mjs`, the CI raw-hex gate, and `vercel.json`
rewrites for all six modules.

**One stale item.**
[`modules.ts`](../packages/entitlements/src/lib/entitlements/modules.ts) still lists `m5` as
`status: "planned"` with routes lacking the trailing slash, contradicting `0005` and `0006`. It is only
the pre-load / query-error fallback and the file's own header says the migration wins — but it should
be resynced.

---

## 9. M5 integration — Complete functionally, never run end-to-end

**Present.** Migrated into `apps/m5-documents` and re-scoped from the pilot's bare
`owner_id = auth.uid()` to `org_id` + `has_module()`, with the reasoning recorded in
[`0003`'s header](../supabase/migrations/0003_m5_documents.sql). Routes are gated with
`ProtectedRoute` + `RequireModule id="m5"`
([`App.tsx:36-40`](../apps/m5-documents/src/App.tsx:36)); `base: '/m5/'` and `basename="/m5"` are set;
the shell dev proxy puts both apps on one origin so SSO works locally; `0005` marks the module live.
It uses the vendored client factory rather than its own Supabase client (rule 6). All M5 tests pass
under the monorepo, and typecheck and build are clean.

**Two blockers before any live test.**

1. **No org provisioning exists.** Signup is enabled, but nothing creates an `orgs` or `org_members`
   row — no trigger, no RPC, no admin UI, and no `supabase/seed.sql`. Every new user gets a fully
   locked hub, and M5 upload fails at `getCurrentOrgId()` or at `documents-register`'s
   "Not a member of any organization" 403. **Nothing in this platform can be tested live until this
   exists.**
2. **`docs/deploy-checklist.md` is now partly stale.** Its §5 states `_shared/` "has no deployable
   entrypoint yet" when three functions exist, and it does not cover the `--no-verify-jwt` requirement
   from §6.

---

## 10. What is not verified

Stated plainly, because the distinction matters more than the pass counts:

- **No live run against a hosted Supabase project.** No migration in this repo has ever been applied
  to one. The RLS policies, the `has_module()` resolution, the storage bucket policy, and the new path
  guard have all been verified by reading and by unit test — **not by execution against Postgres.**
- **Upload → pipeline → review → export has never completed end-to-end**, in any environment.
- **`docx.test.ts` is a CI flake.** It failed once in a full parallel run at 7260ms, then passed in
  isolation at 132ms and in two subsequent full runs — it exceeds vitest's default 5s timeout under
  parallel load. Unrelated to any change here, but it will intermittently red CI.

---

## 11. Prioritised backlog

| # | Item | Area | Status |
|---|---|---|---|
| 1 | Validate client-supplied storage paths against the caller's org | §4 | **Done** — this branch |
| 2 | Org provisioning + a seed org — nothing can be tested live without it | §9 | Open |
| 3 | Authentication on `pipeline-worker` (shared secret) | §6 | Open |
| 4 | Database-level tests: `has_module()` resolution + cross-org RLS denial | §5 | Open |
| 5 | Role enforcement — at minimum, who may approve an extraction | §7 | Open |
| 6 | `EdgeRuntime.waitUntil()` for the pipeline-worker invocation | §6 | Open |
| 7 | Deterministic org tie-break, or server-authoritative storage paths | §4 | Open |
| 8 | Resync `modules.ts`; refresh `deploy-checklist.md`; reconcile `0006` | §5, §8, §9 | Open |

Items 2 and 4 are the two that most change what this audit could claim next time: 2 unblocks live
verification at all, and 4 converts "RLS is the security boundary" from a reviewed assertion into a
tested one.

---

## 12. Note on the upload failure

Recorded here because it shaped part of this audit. The reported symptom was upload failing after
2.2–2.7 seconds, with a Supabase Free-plan limit proposed as the cause. **A plan-tier limit is not
supported by the evidence**, and `c56c29f` had already fixed a confirmed cause
(`42501 permission denied for schema platform` on the `has_module()` call inside `requireModule()`,
surfaced as a 500 "Entitlement check failed"). Get the actual function log line and shutdown reason
before spending anything on a plan upgrade.

Two code-level suspects remain, and they have different signatures:

1. **§6 gap 2** (un-awaited `fetch`, `oneshot` isolate teardown) produces "upload appears to succeed
   but nothing ever happens" — the document sits at `queued`. It does **not** produce a fast failure.
2. If the failure is genuinely a non-2xx at 2.2–2.7s, the Anthropic Files API upload at
   `documents-register/index.ts:124-136` is the only call on that path that takes seconds and returns
   502.

Neither is a plan limit. The log line distinguishes them.
