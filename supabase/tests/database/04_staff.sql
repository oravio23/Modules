-- Platform staff access — see supabase/tests/database/README.md for conventions.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

-- ── fixtures ──────────────────────────────────────────────────────────────────
insert into platform.orgs (id, name, slug) values
  ('a0000000-0000-0000-0000-000000000301'::uuid, 'Org E', 'test-org-e-04'),
  ('a0000000-0000-0000-0000-000000000302'::uuid, 'Org F', 'test-org-f-04');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('b0000000-0000-0000-0000-000000000301'::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-e@test-04.example', 'x', null, now(), now(), '{}', '{}'),
  ('b0000000-0000-0000-0000-000000000302'::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'staff@test-04.example', 'x', null, now(), now(), '{}', '{}');

insert into platform.org_members (org_id, user_id, role) values
  ('a0000000-0000-0000-0000-000000000301'::uuid, 'b0000000-0000-0000-0000-000000000301'::uuid, 'owner');

-- supabase/seed.sql's dev_auto_platform_admin trigger (local dev only) auto-promotes the
-- FIRST EVER auth.users row to staff whenever platform.platform_admins is empty — which,
-- in this test's own isolated transaction, is our own "non-staff" fixture user inserted
-- above. Explicitly clear any such accidental promotion before asserting they aren't
-- staff, rather than relying on insertion order or transaction history to keep them clean.
delete from platform.platform_admins where user_id = 'b0000000-0000-0000-0000-000000000301'::uuid;

insert into platform.platform_admins (user_id, note) values
  ('b0000000-0000-0000-0000-000000000302'::uuid, 'test fixture')
on conflict (user_id) do nothing;

-- ── a non-staff member sees only their own org ──────────────────────────────
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"b0000000-0000-0000-0000-000000000301","role":"authenticated"}';

select is(
  (select count(*)::int from platform.orgs),
  1, 'a non-staff user''s platform.orgs view is scoped to their own org(s) only'
);
select ok(
  not platform.is_platform_admin(),
  'a non-staff user is correctly reported as not staff'
);

-- ── staff sees every org ─────────────────────────────────────────────────────
reset role;
reset "request.jwt.claims";
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"b0000000-0000-0000-0000-000000000302","role":"authenticated"}';

select ok(
  platform.is_platform_admin(),
  'the seeded fixture user is recognized as platform staff'
);
select ok(
  (select count(*)::int from platform.orgs) >= 2,
  'staff sees every org, not just ones they''re a member of'
);

-- ── nothing exposed to `authenticated` can create a new platform admin ──────
select throws_like(
  $$ insert into platform.platform_admins (user_id, note)
     values ('b0000000-0000-0000-0000-000000000301'::uuid, 'self-promoted') $$,
  '%permission denied%',
  'an authenticated user (even staff) cannot insert into platform_admins — no grant exists for that role'
);

select * from finish();
rollback;
