-- Two-tier entitlement resolution — see supabase/tests/database/README.md for conventions.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- ── fixtures ──────────────────────────────────────────────────────────────────
-- Org A: subscribed to 'broker' (grants m4, m5 — see 0001's seed). Org B: subscribed to
-- 'full' (grants everything), used only for the multi-org OR case at the end.
insert into platform.orgs (id, name, slug) values
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'Org A', 'test-org-a-01'),
  ('a0000000-0000-0000-0000-000000000002'::uuid, 'Org B', 'test-org-b-01');

insert into platform.org_subscriptions (org_id, plan_id, status) values
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'broker', 'active'),
  ('a0000000-0000-0000-0000-000000000002'::uuid, 'full', 'active');

-- Unconfirmed so 0013's triggers don't auto-provision a personal org for these fixtures.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('b0000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-a@test-01.example', 'x', null, now(), now(), '{}', '{}'),
  ('b0000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'member-a@test-01.example', 'x', null, now(), now(), '{}', '{}'),
  ('b0000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'multiorg@test-01.example', 'x', null, now(), now(), '{}', '{}');

insert into platform.org_members (org_id, user_id, role) values
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'b0000000-0000-0000-0000-000000000001'::uuid, 'owner'),
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'b0000000-0000-0000-0000-000000000002'::uuid, 'member'),
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'b0000000-0000-0000-0000-000000000003'::uuid, 'member'),
  ('a0000000-0000-0000-0000-000000000002'::uuid, 'b0000000-0000-0000-0000-000000000003'::uuid, 'owner');

-- ── org_has_module: tier 1 ───────────────────────────────────────────────────
select ok(platform.org_has_module('a0000000-0000-0000-0000-000000000001'::uuid, 'm5'),
  'broker plan entitles org A to m5');
select ok(not platform.org_has_module('a0000000-0000-0000-0000-000000000001'::uuid, 'm1'),
  'broker plan does NOT entitle org A to m1');

-- ── has_module: tier 2 ────────────────────────────────────────────────────────
select ok(platform.has_module('b0000000-0000-0000-0000-000000000001'::uuid, 'm5'),
  'owner gets everything the org is entitled to, with no explicit grant row');
select ok(not platform.has_module('b0000000-0000-0000-0000-000000000002'::uuid, 'm5'),
  'plain member with NO grant row does not get an org-entitled module');

insert into platform.user_module_grants (org_id, user_id, module_id, granted_by) values
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'b0000000-0000-0000-0000-000000000002'::uuid, 'm5',
   'b0000000-0000-0000-0000-000000000001'::uuid);

select ok(platform.has_module('b0000000-0000-0000-0000-000000000002'::uuid, 'm5'),
  'member WITH an explicit grant row now gets the module');

select throws_like(
  $$ insert into platform.user_module_grants (org_id, user_id, module_id, granted_by)
     values ('a0000000-0000-0000-0000-000000000001'::uuid, 'b0000000-0000-0000-0000-000000000002'::uuid, 'm1',
             'b0000000-0000-0000-0000-000000000001'::uuid) $$,
  '%not entitled%',
  'guard_user_module_grant rejects a grant for a module the org is not entitled to'
);

-- ── override beats plan ───────────────────────────────────────────────────────
insert into platform.org_module_overrides (org_id, module_id, granted) values
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'm5', false);

select ok(not platform.org_has_module('a0000000-0000-0000-0000-000000000001'::uuid, 'm5'),
  'a deny override beats the plan grant at the org level');
select ok(not platform.has_module('b0000000-0000-0000-0000-000000000001'::uuid, 'm5'),
  'the owner loses the module too once the org itself is no longer entitled');

-- ── multi-org OR ──────────────────────────────────────────────────────────────
-- user 3 is a plain member of org A (denied above) but OWNER of org B (full plan, so
-- entitled to m5) — has_module must OR across every org they belong to.
select ok(platform.has_module('b0000000-0000-0000-0000-000000000003'::uuid, 'm5'),
  'a multi-org user gets a module if ANY of their orgs grants it');

select * from finish();
rollback;
