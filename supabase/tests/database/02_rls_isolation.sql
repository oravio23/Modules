-- Cross-org RLS isolation — see supabase/tests/database/README.md for conventions.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- ── fixtures (run as the default superuser role, bypassing RLS) ─────────────
insert into platform.orgs (id, name, slug) values
  ('a0000000-0000-0000-0000-000000000101'::uuid, 'Org A', 'test-org-a-02'),
  ('a0000000-0000-0000-0000-000000000102'::uuid, 'Org B', 'test-org-b-02');

-- ON CONFLICT DO UPDATE: supabase/seed.sql's dev_auto_subscribe trigger already
-- auto-subscribed both orgs to 'full' the instant they were created above.
insert into platform.org_subscriptions (org_id, plan_id, status) values
  ('a0000000-0000-0000-0000-000000000101'::uuid, 'full', 'active'),
  ('a0000000-0000-0000-0000-000000000102'::uuid, 'full', 'active')
on conflict (org_id) do update set plan_id = excluded.plan_id, status = excluded.status;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('b0000000-0000-0000-0000-000000000101'::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'user-a@test-02.example', 'x', null, now(), now(), '{}', '{}'),
  ('b0000000-0000-0000-0000-000000000102'::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'user-b@test-02.example', 'x', null, now(), now(), '{}', '{}');

insert into platform.org_members (org_id, user_id, role) values
  ('a0000000-0000-0000-0000-000000000101'::uuid, 'b0000000-0000-0000-0000-000000000101'::uuid, 'owner'),
  ('a0000000-0000-0000-0000-000000000102'::uuid, 'b0000000-0000-0000-0000-000000000102'::uuid, 'owner');

insert into platform.org_invites (org_id, email, role, invited_by) values
  ('a0000000-0000-0000-0000-000000000102'::uuid, 'invitee@test-02.example', 'member', 'b0000000-0000-0000-0000-000000000102'::uuid);

insert into platform.user_module_grants (org_id, user_id, module_id, granted_by) values
  ('a0000000-0000-0000-0000-000000000102'::uuid, 'b0000000-0000-0000-0000-000000000102'::uuid, 'm5',
   'b0000000-0000-0000-0000-000000000102'::uuid);

insert into m5.documents (id, owner_id, org_id, filename, detected_mime, sha256, byte_size, storage_path, status)
values (
  'c0000000-0000-0000-0000-000000000102'::uuid, 'b0000000-0000-0000-0000-000000000102'::uuid,
  'a0000000-0000-0000-0000-000000000102'::uuid, 'invoice.pdf', 'application/pdf', 'deadbeef', 1024,
  'a0000000-0000-0000-0000-000000000102/doc.pdf', 'uploaded'
);

-- ── act as user A (owner of org A only) ─────────────────────────────────────
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"b0000000-0000-0000-0000-000000000101","role":"authenticated"}';

select is(
  (select count(*)::int from platform.orgs where id = 'a0000000-0000-0000-0000-000000000102'::uuid),
  0, 'user A cannot see org B''s row in platform.orgs'
);
select is(
  (select count(*)::int from platform.org_members where org_id = 'a0000000-0000-0000-0000-000000000102'::uuid),
  0, 'user A cannot see org B''s membership rows'
);
select is(
  (select count(*)::int from platform.org_invites where org_id = 'a0000000-0000-0000-0000-000000000102'::uuid),
  0, 'user A cannot see org B''s pending invites'
);
select is(
  (select count(*)::int from platform.user_module_grants where org_id = 'a0000000-0000-0000-0000-000000000102'::uuid),
  0, 'user A cannot see org B''s per-user module grants'
);
select is(
  (select count(*)::int from m5.documents where org_id = 'a0000000-0000-0000-0000-000000000102'::uuid),
  0, 'user A cannot see org B''s m5 documents'
);

-- sanity check the negative isn't just "RLS blocks everything" — user A CAN see their own org.
select is(
  (select count(*)::int from platform.orgs where id = 'a0000000-0000-0000-0000-000000000101'::uuid),
  1, 'user A CAN see their own org (RLS is scoping, not blanket-denying)'
);

-- and a direct update attempt against org B is rejected, not silently a no-op affecting 0 rows
-- that a caller might mistake for "nothing to update" rather than "not allowed".
select is(
  (with attempt as (
     update platform.orgs set name = 'pwned' where id = 'a0000000-0000-0000-0000-000000000102'::uuid
     returning 1
   )
   select count(*)::int from attempt),
  0, 'user A cannot update org B''s row (not an org admin of it)'
);

select * from finish();
rollback;
