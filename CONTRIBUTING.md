# Contributing a module

This repo is a pnpm workspace for **local development only**. Every `apps/*` folder must still work
as a completely standalone, flat Vite project — no pnpm workspace, no `workspace:*` protocol — so it
can be dropped straight into [Lovable](https://lovable.dev) the same way the M5 Document Intelligence
module was (same stack, same reason: ADR-012 picked Vite + React + TS + Tailwind + shadcn/ui +
Supabase specifically because it's what Lovable generates and imports cleanly). Read this before
writing your module — it's short, and skipping it is how six modules end up looking like six
different products, or one that can't be handed to Lovable without surgery.

## `packages/*` are a template registry, not npm dependencies

`packages/tokens` and `packages/ui` hold the **authored source** of the design system, but no app
ever does `import ... from "@oravio/ui"`. Instead, `node scripts/sync-ui.mjs <appName>` **copies**
that source into your app's own `src/` tree — the same model shadcn/ui itself uses (`npx shadcn add`
copies a component into your repo; it doesn't install a UI library). This is deliberate: an app that
imports a workspace package can't be pulled out of the monorepo and handed to Lovable, which expects
a self-contained project with regular npm dependencies, not `workspace:*` links.

After the sync, your app owns real copies of:
- `src/components/ui/*` — the shadcn primitives (button, dialog, form, etc.)
- `src/components/oravio/*` — the Oravio-branded components (`HairlineGrid`, `ModuleCard`, `Eyebrow`, `StatusPill`, `Section`, `DisplayHeading`, `Logo`, ...)
- `src/lib/utils.ts` — `cn()`
- `src/oravio-preset.ts` — the Tailwind theme, referenced by your app's own `tailwind.config.ts` via `presets: [oravioPreset]`
- `src/index.css` — generated from `packages/tokens/src/tokens.css`

**Never hand-edit those five locations.** If you need a new shared component or a token change, add
it to `packages/ui` or `packages/tokens`, then re-run the sync — otherwise your fix vanishes the next
time someone else syncs and overwrites your app's copy.

## The module contract

1. **Copy `apps/_template`**, don't start from scratch. Rename it to `apps/m<N>-<slug>` (e.g.
   `apps/m1-sourcing`), then run `node scripts/sync-ui.mjs m<N>-<slug>` to vendor the design system in.
   The template already has the auth provider, route guard, and shared header/footer wired up.
2. **Claim a Postgres schema.** Your module owns `supabase/migrations/NNNN_m<N>_<slug>_init.sql`,
   which does `create schema if not exists m<N>` and creates your tables inside it. Don't touch
   another module's schema or the shared `platform` schema.
3. **Every table you create needs org-scoped RLS**, following the pattern in
   `apps/_template/supabase/migration.sql.example`:

   ```sql
   using (
     org_id in (select platform.my_org_ids())
     and platform.has_module(auth.uid(), 'm<N>')
   )
   ```

   The `has_module()` check is not optional — without it, a user who loses their entitlement (plan
   downgrade, cancellation) keeps reading your module's data through direct table access even though
   the hub no longer shows it to them.

4. **Register your module** in `platform.modules` (one row, in your migration) so it appears in the
   hub's module grid and in `platform.my_modules()`. Use the canonical id/name/personas/status from
   `supabase/migrations/0001_platform_core.sql` — don't invent new copy for something oravio.co
   already describes.

5. **Never write raw hex colors, never hardcode `hsl(...)`, in your own pages/components.** Use the
   CSS variables from your app's synced `src/index.css` (`var(--navy)`, `var(--teal)`, etc.) or the
   Tailwind classes `src/oravio-preset.ts` maps to them. CI greps every module's own code for raw hex
   and fails the build if it finds one — the vendored `components/ui`, `components/oravio`, and
   `lib/auth`/`lib/entitlements` folders are exempt since they're copies you never hand-edit anyway.

6. **Never instantiate your own Supabase client.** Use the client factory from your app's synced auth
   provider (vendored the same way as `@oravio/ui` — see `apps/_template/src/lib/auth`). A second
   client means a second session, which breaks single sign-on for that module's users.

7. **Gate every module route with `<RequireModule id="m<N>">`**, and gate every edge function you
   write with `requireModule(req, 'm<N>')`. The hub graying out your card is UX, not security — the
   RLS policy and the edge-function check are the actual gate.

8. **Reuse the vendored `src/components/oravio/*` components** — especially `<HairlineGrid>`,
   `<ModuleCard>`, `<Section>`, `<Eyebrow>`, `<StatusPill>`, `<DisplayHeading>` — before reaching for a
   raw `<div>` and custom CSS. If a layout you need doesn't exist yet, add it to `packages/ui/src/oravio`
   and re-sync, rather than one-off styling it inside your app, so the next module gets it for free too.

## Local setup

```bash
pnpm install
node scripts/sync-ui.mjs m<N>-<slug>   # re-run after pulling changes to packages/tokens or packages/ui
cp apps/m<N>-<slug>/.env.example apps/m<N>-<slug>/.env.local   # fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
supabase start                          # requires Docker; one shared local Supabase project for all modules
pnpm --filter @oravio/m<N>-<slug> dev
```

**Getting your first org.** Sign up once through the shell (magic link or Google/Microsoft) —
`platform.handle_new_user()` (see `supabase/migrations/0008_org_auto_provisioning.sql`) creates
an org and adds you as its owner automatically on signup, and `supabase/seed.sql`'s
dev-only trigger immediately subscribes that org to the `full` plan, so your hub is fully
unlocked with no manual SQL. That auto-subscribe step is local-only — `supabase db push` never
runs `seed.sql` against a cloud project, so a real signup there gets an org with zero
entitlements until someone deliberately grants a plan or override, same as any other customer.

**To test SSO across the shell and your module locally**, also run `pnpm --filter @oravio/shell dev`
and open `http://localhost:5173/m<N>/` — not your module's own port directly. `apps/shell/vite.config.ts`
proxies `/m<N>` to your module's dev server, putting both apps on the shell's origin (`:5173`) the same
way `vercel.json` rewrites do in production. Opening a module on its own port (e.g. `:5175`) skips that
proxy, so the session set by logging in through the shell won't be visible there — the module will look
broken (redirects to a blank page) even though nothing is actually wrong; that's a `localStorage`
same-origin artifact of standalone local dev, not a bug in the module itself. Add your module's proxy
entry (and matching `server.hmr` block, see `apps/m5-documents/vite.config.ts`) to `apps/shell/vite.config.ts`
when you bring your module up locally.

**Quick demo shortcut for shell + M5 specifically:** double-click `start-hub.bat` at the repo
root — it launches both dev servers (shell on :5173, m5-documents on :5175) in separate windows
and opens the hub in your browser. Use `stop-hub.bat` to tear both down, including anything
still bound to those ports outside their windows. This is a convenience wrapper around the two
`pnpm --filter` commands above, not a replacement for understanding what they do.

**For day-to-day development**, `pnpm dev` at the repo root runs both servers in one terminal
(via `concurrently`, output prefixed `shell`/`m5`) instead of two separate windows — more
convenient once you're actually working in the code rather than just demoing it.

## Before opening a PR

```bash
pnpm -r typecheck
pnpm -r test
pnpm -r build
pnpm -r lint
```

CI runs the same four commands plus the raw-hex grep gate. All five must pass.

## Deploy model

Every module deploys as its own Vercel project. `app.oravio.co` itself is the `apps/shell` project's
domain, and `apps/shell/vercel.json` rewrites `/m<N>/*` to your module's own deployment URL — add your
module's row there (placeholder URLs are already in for m1–m6) once you have a real deployment URL to
put in it. This means:

- Supabase's session (stored in `localStorage`) is shared across every module for free — that's what
  makes this single sign-on instead of six separate logins.
- Your app must set Vite `base: '/m<N>/'` and the router `basename="/m<N>"` (already done in
  `apps/_template`).
- Your broken build only takes down your own module's route, not the hub or anyone else's module.

## Moving an app to Lovable

Because every app is flat and self-contained after `sync-ui.mjs`, handing one to Lovable is the same
process M5 went through (see M5's `docs/lovable-handoff-runbook.md` if you want the long version):
push the app's own folder as its own repo, set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in
Lovable's project settings, and import. No monorepo, no workspace protocol, nothing to strip out.
