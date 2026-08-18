-- Role enforcement — see supabase/tests/database/README.md for conventions.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- ── fixtures ──────────────────────────────────────────────────────────────────
-- Org C: one owner, two plain members (member1 tries to act on member2 — never on
-- themselves — so the "can't change your own row" guard doesn't muddy the "not an admin"
-- assertion). Org D: lone owner, to exercise the last-owner guard on its own.
insert into platform.orgs (id, name, slug) values
  ('a0000000-0000-0000-0000-000000000201'::uuid, 'Org C', 'test-org-c-03'),
  ('a0000000-0000-0000-0000-000000000202'::uuid, 'Org D', 'test-org-d-03');

-- ON CONFLICT DO UPDATE: supabase/seed.sql's dev_auto_subscribe trigger already
-- auto-subscribed org C to 'full' the instant it was created above.
insert into platform.org_subscriptions (org_id, plan_id, status) values
  ('a0000000-0000-0000-0000-000000000201'::uuid, 'full', 'active')
on conflict (org_id) do update set plan_id = excluded.plan_id, status = excluded.status;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('b0000000-0000-0000-0000-000000000201'::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-c@test-03.example', 'x', null, now(), now(), '{}', '{}'),
  ('b0000000-0000-0000-0000-000000000202'::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'member1-c@test-03.example', 'x', null, now(), now(), '{}', '{}'),
  ('b0000000-0000-0000-0000-000000000203'::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'member2-c@test-03.example', 'x', null, now(), now(), '{}', '{}'),
  ('b0000000-0000-0000-0000-000000000204'::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-d@test-03.example', 'x', null, now(), now(), '{}', '{}');

insert into platform.org_members (org_id, user_id, role) values
  ('a0000000-0000-0000-0000-000000000201'::uuid, 'b0000000-0000-0000-0000-000000000201'::uuid, 'owner'),
  ('a0000000-0000-0000-0000-000000000201'::uuid, 'b0000000-0000-0000-0000-000000000202'::uuid, 'member'),
  ('a0000000-0000-0000-0000-000000000201'::uuid, 'b0000000-0000-0000-0000-000000000203'::uuid, 'member'),
  ('a0000000-0000-0000-0000-000000000202'::uuid, 'b0000000-0000-0000-0000-000000000204'::uuid, 'owner');

-- supabase/seed.sql's dev_auto_platform_admin trigger (local dev only) auto-promotes the
-- FIRST EVER auth.users row to staff whenever platform.platform_admins is empty — in this
-- test's own isolated transaction, that's owner-c above. Left uncleared, is_org_admin() OR
-- is_platform_admin() checks below would pass for the wrong reason.
delete from platform.platform_admins
 where user_id in (
   'b0000000-0000-0000-0000-000000000201'::uuid, 'b0000000-0000-0000-0000-000000000202'::uuid,
   'b0000000-0000-0000-0000-000000000203'::uuid, 'b0000000-0000-0000-0000-000000000204'::uuid
 );

-- ── act as member1 of org C (a plain member, not an admin) ──────────────────
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"b0000000-0000-0000-0000-000000000202","role":"authenticated"}';

-- The data-modifying WITH must be at the TOP LEVEL of the statement — Postgres rejects one
-- nested inside a subquery passed as a function argument (see 02_rls_isolation.sql's same fix).
with attempt as (
  update platform.org_members set role = 'admin'
   where org_id = 'a0000000-0000-0000-0000-000000000201'::uuid
     and user_id = 'b0000000-0000-0000-0000-000000000203'::uuid
  returning 1
)
select is(
  (select count(*)::int from attempt),
  0, 'a plain member cannot promote another member (not an org admin)'
);

select throws_like(
  $$ insert into platform.org_invites (org_id, email, role, invited_by)
     values ('a0000000-0000-0000-0000-000000000201'::uuid, 'someone@test-03.example', 'member', 'b0000000-0000-0000-0000-000000000202'::uuid) $$,
  '%row-level security%',
  'a plain member cannot create an org invite'
);

select throws_like(
  $$ insert into platform.user_module_grants (org_id, user_id, module_id, granted_by)
     values ('a0000000-0000-0000-0000-000000000201'::uuid, 'b0000000-0000-0000-0000-000000000203'::uuid, 'm5', 'b0000000-0000-0000-0000-000000000202'::uuid) $$,
  '%row-level security%',
  'a plain member cannot write another member''s module grants directly'
);

select throws_like(
  $$ select platform.set_user_modules('a0000000-0000-0000-0000-000000000201'::uuid, 'b0000000-0000-0000-0000-000000000203'::uuid, array['m5']) $$,
  '%Not authorized%',
  'a plain member cannot call set_user_modules for their org either'
);

-- ── last-owner guard fires regardless of caller (it's a trigger, not an RLS policy) ────────
reset role;
reset "request.jwt.claims";

select throws_like(
  $$ update platform.org_members set role = 'admin'
     where org_id = 'a0000000-0000-0000-0000-000000000202'::uuid
       and user_id = 'b0000000-0000-0000-0000-000000000204'::uuid $$,
  '%at least one owner%',
  'demoting an org''s only owner is rejected even for a service-role caller'
);

select throws_like(
  $$ delete from platform.org_members
     where org_id = 'a0000000-0000-0000-0000-000000000202'::uuid
       and user_id = 'b0000000-0000-0000-0000-000000000204'::uuid $$,
  '%at least one owner%',
  'removing an org''s only owner is rejected the same way'
);

-- an org WITH a second owner can freely demote the first — the guard is about the count,
-- not about owners being special-cased into permanence.
insert into platform.org_members (org_id, user_id, role) values
  ('a0000000-0000-0000-0000-000000000202'::uuid, 'b0000000-0000-0000-0000-000000000201'::uuid, 'owner');

select lives_ok(
  $$ update platform.org_members set role = 'admin'
     where org_id = 'a0000000-0000-0000-0000-000000000202'::uuid
       and user_id = 'b0000000-0000-0000-0000-000000000204'::uuid $$,
  'demoting one owner succeeds once a second owner exists'
);

select * from finish();
rollback;
