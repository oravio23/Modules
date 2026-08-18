# Prompt for Lovable

**Rewritten for the current monorepo state** — the previous version of this file described the
original pre-monorepo M5 pilot (anonymous sessions, no login page, migrations `0001_init.sql`
through `0003_seed_profiles.sql`). None of that is accurate any more: this app now sits behind
real SSO provided by `apps/shell`, its tables live in schema `m5` (not bare `public`), and there
are nine migrations at the repo root, not three. See
[docs/lovable-handoff-runbook.md](lovable-handoff-runbook.md) for the full reasoning, and its §0
for a security note (rotate `ANTHROPIC_API_KEY`) to handle before you start.

**Read this before pasting the prompt below.** `apps/m5-documents` has no `supabase/` directory
of its own — every migration and edge function it depends on lives at the monorepo root's
`supabase/`, shared with the platform schema and the other five modules. If you're importing
this app's folder into its own repo (per `CONTRIBUTING.md`'s "Moving an app to Lovable"), you
must also copy a `supabase/` directory into that new repo containing:

- `supabase/migrations/0001_platform_core.sql`, `0002_module_schemas.sql`,
  `0003_m5_documents.sql`, `0004_m5_seed_profiles.sql`, `0005_m5_module_live.sql`,
  `0007_service_role_grants.sql`, `0008_org_auto_provisioning.sql` — in that order.
  (`0006_module_routes_trailing_slash.sql` and `0009_m3_not_yet_deployed.sql` only affect
  modules other than m5 and can be skipped for a standalone M5 deploy.)
- `supabase/functions/{documents-register,pipeline-worker,export-result,_shared}/` and
  `supabase/functions/{deno.json,deno.lock}`.
- `supabase/config.toml`, for reference — its `[auth]`/`[api]` values are local-only and don't
  carry to a cloud project (see step 8 below), but it documents what to set by hand.

**Also read this:** this app's `ProtectedRoute` (in `src/lib/auth/`, vendored from
`packages/auth`) redirects a signed-out user to an origin-absolute `/` — that's the Oravio shell's
login page in the real deployment. If you import M5 alone with no shell, a signed-out visitor
hits a path this app's own router (mounted at `basename="/m5"`) doesn't define, and gets a blank
page instead of a login form. Either import and deploy `apps/shell` alongside this app (matching
`CONTRIBUTING.md`'s "Deploy model" — one Vercel/Lovable project per app, the shell owns `/` and
rewrites `/m5/*` to this one), or adapt `ProtectedRoute` to point at a login page that actually
exists in your standalone deployment.

---

Paste the block below into Lovable's chat after importing this repo (GitHub → Lovable, or
Lovable's own "import existing project" flow) and connecting its native Supabase integration.

```
This project is a document-extraction module (Vite + React + TypeScript + Tailwind + shadcn/ui
frontend, Supabase backend: Postgres, Storage, Auth, Edge Functions, Realtime) that is normally
one of several apps sharing a single Supabase project and a single sign-on session. I need help
finishing the Supabase Cloud setup so it runs on real hosted infrastructure instead of my local
machine. Please do the following, in order, and tell me clearly if any step fails or behaves
unexpectedly rather than assuming it worked:

1. Connect a Supabase Cloud project to this app (create a new one if I don't already have one
   linked).

2. Apply the SQL migrations in supabase/migrations/ to that project, in filename order:
   0001_platform_core.sql, 0002_module_schemas.sql, 0003_m5_documents.sql,
   0004_m5_seed_profiles.sql, 0005_m5_module_live.sql, 0007_service_role_grants.sql,
   0008_org_auto_provisioning.sql. (Skip 0006 and 0009 — they only affect modules other than
   this one.) 0004 seeds an `m5.profiles` table that `m5.extractions.profile_id` has a NOT NULL
   foreign key into — if that migration doesn't run, every document upload will fail right
   when it tries to save results. Confirm afterward that `select id from m5.profiles;` returns
   two rows: 'generic' and 'commercial_invoice'.

3. In Authentication → Sign In / Providers, confirm "Allow anonymous sign-ins" is OFF (it should
   default to off on a new project — just confirm, don't enable it). This app authenticates real
   users via magic link and, once you configure them, Google and Microsoft OAuth — there is no
   anonymous-session mode any more.

4. In Data API → Exposed schemas, add `platform` and `m5` (`public` is exposed by default;
   these two are not). Without this, every `supabase.schema("platform").rpc(...)` call 404s and
   this app's own entitlement check (`requireModule`) fails closed.

5. Confirm a private Storage bucket named 'documents' exists with the org-scoped RLS policy
   `m5_documents_bucket_org_scoped`, and that both `m5.jobs` and `m5.documents` are added to the
   `supabase_realtime` publication (the UI subscribes to both for live pipeline-stage progress
   and queue updates). All three should already be defined by migration 0003 — just confirm
   they took effect rather than assuming it.

6. Deploy all three Edge Functions in supabase/functions/: documents-register, pipeline-worker,
   export-result. pipeline-worker specifically needs to be deployed WITHOUT JWT verification
   (the CLI flag is --no-verify-jwt, or the dashboard equivalent) — it's only ever called
   server-to-server with a service-role bearer token, never directly by a browser, and
   config.toml's verify_jwt=false setting for it is local-only and does not carry to a cloud
   deploy.

7. Set ANTHROPIC_API_KEY as a Supabase secret on this project (I'll give you the value
   separately — never put it in a file, an env var prefixed VITE_, or anywhere the frontend
   bundle could read it). Confirm it only needs to exist as a server-side Edge Function secret.

8. Set these two frontend environment variables for this project (from the Supabase dashboard's
   API settings page): VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. Some dashboards now label
   the second one "publishable key" instead of "anon key" — same value, just confirm you're
   using the public/anon-tier key, not the secret/service-role one.

9. Sign up through whatever login entry point this deployment actually has (see this repo's own
   note above about ProtectedRoute assuming a shell). A database trigger
   (platform.handle_new_user, from migration 0008) creates an org and makes you its owner
   automatically — but grants no module access by itself, on purpose. Confirm this by finding
   your new org's id (select id from platform.orgs order by created_at desc limit 1;), then
   grant yourself m5 access with:
   insert into platform.org_module_overrides (org_id, module_id, granted)
   values ('<your-org-id>', 'm5', true);
   This is the same one-off mechanism a real pilot customer would get, not a hidden bypass.

10. Once all of the above is done, walk me through a smoke test: I'll upload a small file and we
    should see it move through transcribe → classify → extract → review stages. If anything
    fails, show me the actual error from the m5.jobs table's last_error column rather than just
    saying "it didn't work."

This project has only ever been tested against a local Docker Supabase stack before now, so
treat every one of these steps as unverified against real infrastructure until we've confirmed
it ourselves. Do not run `supabase db push` with `--include-seed`, and do not run
`supabase config push` — the latter would also push this project's local-only site_url and
other auth/storage settings onto the cloud project.
```
