-- The read/write RPCs the admin UIs call — see supabase/tests/database/README.md.
--
-- 01-07 exercise the entitlement LOGIC directly (has_module, RLS policies, guard triggers)
-- and never invoke these functions. That gap let a shipped bug sit undetected: 0012 declared
-- org_module_matrix's `email` column as `text` while auth.users.email is varchar(255), so
-- every call failed with 42804 and BOTH per-user module grids rendered permanently empty
-- (fixed in 0016). A function that is never called by any test is a function no test covers,
-- however green the suite looks — so these assertions actually SELECT from each RPC.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- ── fixtures ──────────────────────────────────────────────────────────────────
insert into platform.orgs (id, name, slug) values
  ('a0000000-0000-0000-0000-000000000701'::uuid, 'Org L', 'test-org-l-08');
insert into platform.org_subscriptions (org_id, plan_id, status) values
  ('a0000000-0000-0000-0000-000000000701'::uuid, 'broker', 'active')
on conflict (org_id) do update set plan_id = excluded.plan_id, status = excluded.status;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('b0000000-0000-0000-0000-000000000701'::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-l@test-08.example', 'x', null, now(), now(), '{}', '{}'),
  ('b0000000-0000-0000-0000-000000000702'::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'member-l@test-08.example', 'x', null, now(), now(), '{}', '{}'),
  ('b0000000-0000-0000-0000-000000000703'::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'outsider-l@test-08.example', 'x', null, now(), now(), '{}', '{}');

insert into platform.org_members (org_id, user_id, role) values
  ('a0000000-0000-0000-0000-000000000701'::uuid, 'b0000000-0000-0000-0000-000000000701'::uuid, 'owner'),
  ('a0000000-0000-0000-0000-000000000701'::uuid, 'b0000000-0000-0000-0000-000000000702'::uuid, 'member');

-- seed.sql's dev_auto_platform_admin may have promoted a fixture user; clear so the
-- authorization assertions below test org role, not accidental staff.
delete from platform.platform_admins
 where user_id in (
   'b0000000-0000-0000-0000-000000000701'::uuid, 'b0000000-0000-0000-0000-000000000702'::uuid,
   'b0000000-0000-0000-0000-000000000703'::uuid
 );

-- ── as the org owner ─────────────────────────────────────────────────────────
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"b0000000-0000-0000-0000-000000000701","role":"authenticated"}';

-- The regression that motivated this file: the call itself must not raise.
select lives_ok(
  $$ select * from platform.org_module_matrix('a0000000-0000-0000-0000-000000000701'::uuid) $$,
  'org_module_matrix() executes (regression: 42804 varchar/text mismatch on auth.users.email)'
);
select is(
  (select count(*)::int from platform.org_module_matrix('a0000000-0000-0000-0000-000000000701'::uuid)),
  12, 'org_module_matrix() returns one row per member per module (2 members x 6 modules)'
);
-- broker grants m4+m5 only, so org_entitled must be true for exactly those, per member.
select is(
  (select count(*)::int from platform.org_module_matrix('a0000000-0000-0000-0000-000000000701'::uuid)
    where org_entitled),
  4, 'org_entitled reflects the org plan (broker = m4+m5) for each of the 2 members'
);
-- The owner is auto-effective on entitled modules without any grant row; the member is not.
select is(
  (select count(*)::int from platform.org_module_matrix('a0000000-0000-0000-0000-000000000701'::uuid)
    where user_id = 'b0000000-0000-0000-0000-000000000701'::uuid and effective),
  2, 'an owner is effective on every entitled module with no grant rows at all'
);
select is(
  (select count(*)::int from platform.org_module_matrix('a0000000-0000-0000-0000-000000000701'::uuid)
    where user_id = 'b0000000-0000-0000-0000-000000000702'::uuid and effective),
  0, 'a plain member is effective on nothing until explicitly granted'
);

select lives_ok(
  $$ select * from platform.org_entitlements('a0000000-0000-0000-0000-000000000701'::uuid) $$,
  'org_entitlements() executes'
);
select is(
  (select source from platform.org_entitlements('a0000000-0000-0000-0000-000000000701'::uuid)
    where module_id = 'm5'),
  'plan', 'org_entitlements() reports the entitlement source the override tri-state round-trips against'
);

-- set_user_modules is the single write the checkbox grids issue.
select lives_ok(
  $$ select platform.set_user_modules(
       'a0000000-0000-0000-0000-000000000701'::uuid,
       'b0000000-0000-0000-0000-000000000702'::uuid,
       array['m5']) $$,
  'set_user_modules() grants a member one of the org''s entitled modules'
);
select is(
  (select count(*)::int from platform.org_module_matrix('a0000000-0000-0000-0000-000000000701'::uuid)
    where user_id = 'b0000000-0000-0000-0000-000000000702'::uuid and effective),
  1, 'that member is now effective on exactly the one granted module'
);

select * from finish();
rollback;
