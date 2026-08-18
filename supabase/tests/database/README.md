# Database tests (pgTAP)

Run with `supabase test db` (add `--local` if a project is linked). Every `*.sql` file here
is picked up automatically by `pg_prove` — this file is intentionally `.md`, not `.sql`, so
it isn't swept in and run as an empty, plan-less "test".

## Why these exist

RLS is the actual security boundary for this platform (see `0001_platform_core.sql`'s own
header comment), and until now there were zero tests against it — every existing test in
this repo is pure TypeScript (`apps/m5-documents/src/lib/**`,
`supabase/functions/_shared/**`). These are the first tests that run as a real Postgres role
against the real RLS policies, not just plpgsql function bodies in isolation.

## Conventions every file here follows

1. **`begin; ... rollback;`** wraps the whole file. Nothing here ever persists, so files can
   run in any order, repeatedly, against a real (even seeded) database with no cleanup code
   and no fixture collisions between files.
2. **Fixture users go directly into `auth.users`** — there's no Auth Admin API inside a SQL
   test. Insert them with `email_confirmed_at = null` unless the test is specifically about
   the signup/confirmation triggers (`0013`'s `handle_new_user`/`handle_user_confirmed`) — a
   confirmed timestamp fires `platform.provision_user()`, which auto-creates a personal org,
   and every other file wants exact manual control over which orgs/roles a fixture user has,
   not an extra org for free.
3. **Acting "as" a user for RLS** means setting both the Postgres role and the JWT claim
   PostgREST would normally set — `auth.uid()` reads the claim, not the role:
   ```sql
   set local role authenticated;
   set local "request.jwt.claims" to '{"sub":"<uuid>","role":"authenticated"}';
   ```
   Switch back to `postgres` (or set a different uid) before any fixture setup that needs to
   bypass RLS again.
4. UUIDs are hardcoded per file (not `gen_random_uuid()`) so assertion output stays legible.
   Each file uses its own block, purely for readability — the transaction rollback means
   files could never actually collide.

## Files

| File | Covers |
|---|---|
| `01_entitlements.sql` | Two-tier resolution: org-entitled + user-granted, owner/admin bypass, override beats plan, multi-org OR |
| `02_rls_isolation.sql` | A member of org A cannot read org B's `orgs`/`org_members`/`user_module_grants`/`org_invites`/m5 rows |
| `03_roles.sql` | A `member` cannot change roles, invite, or write `user_module_grants`; last-owner demotion/removal is rejected |
| `04_staff.sql` | Staff read every org; non-staff read only their own; no `authenticated` path can insert into `platform_admins` |
| `05_invites.sql` | Invite redemption creates membership + grants and no personal org; expired/second-pending invites are rejected; email match is case-insensitive |
| `06_m5_review.sql` | A `member` cannot approve an extraction or rewrite `documents.status`/`owner_id`; an `admin` can approve |
