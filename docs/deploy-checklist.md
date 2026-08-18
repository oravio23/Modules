# Deploy checklist — things that only exist on a real Supabase Cloud project

This repo has never been run against a hosted Supabase project — everything below is what
reading `supabase/config.toml` and the migrations says needs to happen, not something already
verified live. Local `supabase start` reads `config.toml` directly; a cloud project does not,
so anything set only there is invisible until someone configures it by hand in the dashboard.

## 1. Expose the `platform` schema to the API — do this before the first smoke test

`supabase/config.toml`'s `[api].schemas` includes `platform` (and `m1`–`m6`) for the **local**
stack only. `supabase db push` does not carry this to a cloud project.

**Symptom if skipped:** every RPC call that does `supabase.schema("platform").rpc(...)` —
`my_modules()`, `has_module()` — fails with a 404/`PGRST106`. `useEntitlements` (see
[packages/entitlements/src/lib/entitlements/useEntitlements.ts](../packages/entitlements/src/lib/entitlements/useEntitlements.ts))
catches that as a query error and falls back to every module marked ungranted, so the hub
renders a **fully locked grid with no visible error** — it now also shows an "Couldn't check
your access" banner (see [apps/shell/src/pages/Hub.tsx](../apps/shell/src/pages/Hub.tsx)) so this
doesn't look identical to a customer who genuinely has zero modules, but the underlying cause
still needs fixing at the source.

**Fix:** Dashboard → Project Settings → Data API → Exposed schemas → add `platform` (and each
`m<N>` schema once that module has real tables a frontend queries directly, rather than only
through edge functions).

## 2. Anonymous sign-ins must stay OFF

Unlike the M5 module's pilot, this platform's entitlement model is keyed off real
`platform.org_members` rows tied to `auth.users(id)` — an anonymous session can never resolve to
an org, so it can never be granted a module. `config.toml`'s
`enable_anonymous_sign_ins = false` is already the local default; a fresh cloud project also
defaults this off, but confirm rather than assume (Dashboard → Authentication → Sign In /
Providers).

## 3. Configure Google and Microsoft OAuth for real

`LoginCard` (see
[packages/auth/src/lib/auth/LoginCard.tsx](../packages/auth/src/lib/auth/LoginCard.tsx)) calls
`supabase.auth.signInWithOAuth({ provider: "google" | "azure", ... })`. Neither provider is
configured by `config.toml` — that's dashboard-only, per-project: Dashboard → Authentication →
Providers → enable Google and enable Azure (Microsoft), each with a real OAuth client
ID/secret from that provider's own console. Until this is done, both OAuth buttons on the
landing page fail with a provider-not-enabled error from Supabase.

## 4. Update `site_url` and redirect URLs for the real domain

`config.toml`'s `site_url = "http://localhost:5173"` and `additional_redirect_urls` are
local-only. On the cloud project: Dashboard → Authentication → URL Configuration → set
`Site URL` to `https://app.oravio.co` and add it (plus `https://app.oravio.co/auth/callback`)
to the redirect allow-list. Without this, magic-link emails and OAuth callbacks redirect to
`localhost` instead of the production domain.

**Do not** use `supabase config push` as a shortcut for any of the above — it would also push
`config.toml`'s local-only `site_url` and other `[auth]`/`[storage]` values onto the cloud
project, undoing step 4 the moment someone runs it.

## 5. Edge functions

Three functions exist today, all owned by M5: `documents-register`, `pipeline-worker`, and
`export-result`. Deploy each with `supabase functions deploy <name>`.

**`pipeline-worker` needs `--no-verify-jwt` on deploy.** `config.toml`'s
`[functions.pipeline-worker] verify_jwt = false` is local-only and does not carry to a cloud
deploy — pass the flag explicitly (`supabase functions deploy pipeline-worker --no-verify-jwt`),
or every fire-and-forget call `documents-register` makes to it will fail with a 401. It's safe to
leave unauthenticated at the network layer because it's never called by a browser, only
server-to-server with a service-role bearer token — see
[`documents-register/index.ts`](../supabase/functions/documents-register/index.ts)'s own call site.
`documents-register` and `export-result` keep the default `verify_jwt = true`.

`supabase/functions/deno.json` is the shared import map (`@supabase/supabase-js`, `ajv`,
`ajv-formats`, `@anthropic-ai/sdk`, `jszip`, etc.) — add your own function's npm dependencies
there as you need them, matching the pattern M5 already established.
