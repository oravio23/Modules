-- Regression test for 0015: guard_org_member_write must not block FK cascade deletes.
-- See supabase/tests/database/README.md for conventions.
--
-- The bug this pins: platform.org_members has `on delete cascade` FKs to BOTH auth.users and
-- platform.orgs (0001:26-27). 0010's last-owner guard fired on those cascade-issued DELETEs
-- and aborted the parent statement, so no user and no org could ever be deleted — every
-- self-serve signup is the sole owner of a personal org (0013), so this hit literally every
-- account. Deleting the membership row first hit the same guard, leaving no recovery path.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

-- ── fixtures ──────────────────────────────────────────────────────────────────
insert into platform.orgs (id, name, slug) values
  ('a0000000-0000-0000-0000-000000000601'::uuid, 'Org I', 'test-org-i-07'),
  ('a0000000-0000-0000-0000-000000000602'::uuid, 'Org J', 'test-org-j-07');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('b0000000-0000-0000-0000-000000000601'::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sole-owner@test-07.example', 'x', null, now(), now(), '{}', '{}'),
  ('b0000000-0000-0000-0000-000000000602'::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'org-j-owner@test-07.example', 'x', null, now(), now(), '{}', '{}');

insert into platform.org_members (org_id, user_id, role) values
  ('a0000000-0000-0000-0000-000000000601'::uuid, 'b0000000-0000-0000-0000-000000000601'::uuid, 'owner'),
  ('a0000000-0000-0000-0000-000000000602'::uuid, 'b0000000-0000-0000-0000-000000000602'::uuid, 'owner');

-- ── deleting a user cascades away their sole-owner membership ────────────────
select lives_ok(
  $$ delete from auth.users where id = 'b0000000-0000-0000-0000-000000000601'::uuid $$,
  'deleting a user who is the SOLE OWNER of an org succeeds (cascade is not blocked by the last-owner guard)'
);
select is(
  (select count(*)::int from platform.org_members where user_id = 'b0000000-0000-0000-0000-000000000601'::uuid),
  0, 'the cascade actually removed their org_members row'
);

-- ── deleting an org cascades away its memberships ────────────────────────────
select lives_ok(
  $$ delete from platform.orgs where id = 'a0000000-0000-0000-0000-000000000602'::uuid $$,
  'deleting an org that still has an owner succeeds (cascade is not blocked either)'
);
select is(
  (select count(*)::int from platform.org_members where org_id = 'a0000000-0000-0000-0000-000000000602'::uuid),
  0, 'the cascade actually removed that org''s membership rows'
);

-- ── but the guard still does its real job on DIRECT edits ────────────────────
-- The fix must not weaken the rule it exists for: a direct demotion/removal that would
-- strip an org of its last owner is still rejected.
insert into platform.orgs (id, name, slug) values
  ('a0000000-0000-0000-0000-000000000603'::uuid, 'Org K', 'test-org-k-07');
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values ('b0000000-0000-0000-0000-000000000603'::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'org-k-owner@test-07.example', 'x', null, now(), now(), '{}', '{}');
insert into platform.org_members (org_id, user_id, role) values
  ('a0000000-0000-0000-0000-000000000603'::uuid, 'b0000000-0000-0000-0000-000000000603'::uuid, 'owner');

select throws_like(
  $$ delete from platform.org_members
      where org_id = 'a0000000-0000-0000-0000-000000000603'::uuid
        and user_id = 'b0000000-0000-0000-0000-000000000603'::uuid $$,
  '%at least one owner%',
  'a DIRECT delete of an org''s only owner is still rejected'
);
select throws_like(
  $$ update platform.org_members set role = 'member'
      where org_id = 'a0000000-0000-0000-0000-000000000603'::uuid
        and user_id = 'b0000000-0000-0000-0000-000000000603'::uuid $$,
  '%at least one owner%',
  'a DIRECT demotion of an org''s only owner is still rejected'
);

select * from finish();
rollback;
