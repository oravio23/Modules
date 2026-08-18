-- Org invites + provisioning — see supabase/tests/database/README.md for conventions.
--
-- Unlike the other files, this one deliberately DOES insert auth.users rows with
-- email_confirmed_at already set, because the whole point is exercising the real
-- on_auth_user_created trigger (platform.handle_new_user -> platform.provision_user), not
-- just calling provision_user() directly.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into platform.orgs (id, name, slug) values
  ('a0000000-0000-0000-0000-000000000401'::uuid, 'Org G', 'test-org-g-05');
-- ON CONFLICT DO UPDATE: supabase/seed.sql's dev_auto_subscribe trigger already
-- auto-subscribed org G to 'full' the instant it was created above.
insert into platform.org_subscriptions (org_id, plan_id, status) values
  ('a0000000-0000-0000-0000-000000000401'::uuid, 'full', 'active')
on conflict (org_id) do update set plan_id = excluded.plan_id, status = excluded.status;
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values ('b0000000-0000-0000-0000-000000000401'::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-g@test-05.example', 'x', null, now(), now(), '{}', '{}');
insert into platform.org_members (org_id, user_id, role) values
  ('a0000000-0000-0000-0000-000000000401'::uuid, 'b0000000-0000-0000-0000-000000000401'::uuid, 'owner');

-- ── 1. a pending invite is redeemed when the invited email confirms signup ──────────────────
insert into platform.org_invites (org_id, email, role, module_ids, invited_by) values
  ('a0000000-0000-0000-0000-000000000401'::uuid, 'invitee@test-05.example', 'member', array['m5'],
   'b0000000-0000-0000-0000-000000000401'::uuid);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values ('b0000000-0000-0000-0000-000000000402'::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'invitee@test-05.example', 'x', now(), now(), now(), '{}', '{}');

select is(
  (select role from platform.org_members
    where org_id = 'a0000000-0000-0000-0000-000000000401'::uuid and user_id = 'b0000000-0000-0000-0000-000000000402'::uuid),
  'member', 'redeeming the invite makes the invitee a member of the INVITING org with the invited role'
);
select ok(
  exists (select 1 from platform.user_module_grants
           where org_id = 'a0000000-0000-0000-0000-000000000401'::uuid
             and user_id = 'b0000000-0000-0000-0000-000000000402'::uuid and module_id = 'm5'),
  'redemption also applies the invite''s starting module grants'
);
select is(
  (select status from platform.org_invites where org_id = 'a0000000-0000-0000-0000-000000000401'::uuid and email = 'invitee@test-05.example'),
  'accepted', 'the invite is marked accepted once redeemed'
);
select is(
  (select count(*)::int from platform.org_members where user_id = 'b0000000-0000-0000-0000-000000000402'::uuid),
  1, 'the invitee gets NO extra personal org — exactly one membership, the one the invite gave them'
);

-- ── 2. an expired invite is ignored, and the fallback personal org kicks in instead ─────────
insert into platform.org_invites (org_id, email, role, expires_at, invited_by) values
  ('a0000000-0000-0000-0000-000000000401'::uuid, 'toolate@test-05.example', 'member', now() - interval '1 day',
   'b0000000-0000-0000-0000-000000000401'::uuid);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values ('b0000000-0000-0000-0000-000000000403'::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'toolate@test-05.example', 'x', now(), now(), now(), '{}', '{}');

select isnt(
  (select org_id from platform.org_members where user_id = 'b0000000-0000-0000-0000-000000000403'::uuid),
  'a0000000-0000-0000-0000-000000000401'::uuid,
  'an EXPIRED invite is not redeemed — the user falls back to their own personal org instead'
);

-- ── 3. a second pending invite to the same (org, email) is rejected ─────────────────────────
insert into platform.org_invites (org_id, email, role, invited_by) values
  ('a0000000-0000-0000-0000-000000000401'::uuid, 'dup@test-05.example', 'member', 'b0000000-0000-0000-0000-000000000401'::uuid);

select throws_like(
  $$ insert into platform.org_invites (org_id, email, role, invited_by)
     values ('a0000000-0000-0000-0000-000000000401'::uuid, 'dup@test-05.example', 'viewer', 'b0000000-0000-0000-0000-000000000401'::uuid) $$,
  '%duplicate key%',
  'a second PENDING invite to the same org+email is rejected by org_invites_one_pending'
);

-- ── 4. matching is case-insensitive, both at invite-creation and at redemption ──────────────
insert into platform.org_invites (org_id, email, role, invited_by) values
  ('a0000000-0000-0000-0000-000000000401'::uuid, 'CaseTest@Test-05.example', 'viewer', 'b0000000-0000-0000-0000-000000000401'::uuid);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values ('b0000000-0000-0000-0000-000000000404'::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'casetest@test-05.example', 'x', now(), now(), now(), '{}', '{}');

select is(
  (select role from platform.org_members
    where org_id = 'a0000000-0000-0000-0000-000000000401'::uuid and user_id = 'b0000000-0000-0000-0000-000000000404'::uuid),
  'viewer', 'invite/redemption email matching is case-insensitive'
);

select * from finish();
rollback;
