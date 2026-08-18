-- M5 role enforcement (0014_m5_role_enforcement.sql) — see README.md for conventions.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

-- ── fixtures ──────────────────────────────────────────────────────────────────
insert into platform.orgs (id, name, slug) values
  ('a0000000-0000-0000-0000-000000000501'::uuid, 'Org H', 'test-org-h-06');
insert into platform.org_subscriptions (org_id, plan_id, status) values
  ('a0000000-0000-0000-0000-000000000501'::uuid, 'full', 'active');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('b0000000-0000-0000-0000-000000000501'::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-h@test-06.example', 'x', null, now(), now(), '{}', '{}'),
  ('b0000000-0000-0000-0000-000000000502'::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'member-h@test-06.example', 'x', null, now(), now(), '{}', '{}'),
  ('b0000000-0000-0000-0000-000000000503'::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'viewer-h@test-06.example', 'x', null, now(), now(), '{}', '{}');

insert into platform.org_members (org_id, user_id, role) values
  ('a0000000-0000-0000-0000-000000000501'::uuid, 'b0000000-0000-0000-0000-000000000501'::uuid, 'owner'),
  ('a0000000-0000-0000-0000-000000000501'::uuid, 'b0000000-0000-0000-0000-000000000502'::uuid, 'member'),
  ('a0000000-0000-0000-0000-000000000501'::uuid, 'b0000000-0000-0000-0000-000000000503'::uuid, 'viewer');

insert into platform.user_module_grants (org_id, user_id, module_id, granted_by) values
  ('a0000000-0000-0000-0000-000000000501'::uuid, 'b0000000-0000-0000-0000-000000000502'::uuid, 'm5', 'b0000000-0000-0000-0000-000000000501'::uuid),
  ('a0000000-0000-0000-0000-000000000501'::uuid, 'b0000000-0000-0000-0000-000000000503'::uuid, 'm5', 'b0000000-0000-0000-0000-000000000501'::uuid);

insert into m5.documents (id, owner_id, org_id, filename, detected_mime, sha256, byte_size, storage_path, status)
values (
  'c0000000-0000-0000-0000-000000000501'::uuid, 'b0000000-0000-0000-0000-000000000502'::uuid,
  'a0000000-0000-0000-0000-000000000501'::uuid, 'invoice.pdf', 'application/pdf', 'deadbeef', 1024,
  'a0000000-0000-0000-0000-000000000501/doc.pdf', 'pending_review'
);
insert into m5.extractions (id, document_id, profile_id, profile_version, envelope, review_state)
values (
  'd0000000-0000-0000-0000-000000000501'::uuid, 'c0000000-0000-0000-0000-000000000501'::uuid,
  'generic', '0.1', '{}'::jsonb, 'pending'
);

-- ── a plain member can review (product behaviour: any non-viewer reviews) ───────────────────
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"b0000000-0000-0000-0000-000000000502","role":"authenticated"}';

select lives_ok(
  $$ update m5.extractions set review_state = 'approved' where id = 'd0000000-0000-0000-0000-000000000501'::uuid $$,
  'a plain member can approve an extraction — reviewing is a product feature for members, not just admins'
);
select lives_ok(
  $$ update m5.documents set status = 'reviewed' where id = 'c0000000-0000-0000-0000-000000000501'::uuid $$,
  'a plain member can mark a pending_review document reviewed'
);

reset role;
reset "request.jwt.claims";

-- reset fixtures back to pending for the viewer assertions below
update m5.extractions set review_state = 'pending' where id = 'd0000000-0000-0000-0000-000000000501'::uuid;
update m5.documents set status = 'pending_review' where id = 'c0000000-0000-0000-0000-000000000501'::uuid;

-- ── a viewer cannot review, matching the role's read-only name ──────────────────────────────
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"b0000000-0000-0000-0000-000000000503","role":"authenticated"}';

select throws_like(
  $$ update m5.extractions set review_state = 'approved' where id = 'd0000000-0000-0000-0000-000000000501'::uuid $$,
  '%not a viewer%',
  'a viewer cannot approve an extraction'
);

-- ── neither role can rewrite pipeline-owned columns from the browser ────────────────────────
reset role;
reset "request.jwt.claims";
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"b0000000-0000-0000-0000-000000000502","role":"authenticated"}';

select throws_like(
  $$ update m5.documents set owner_id = 'b0000000-0000-0000-0000-000000000503'::uuid
     where id = 'c0000000-0000-0000-0000-000000000501'::uuid $$,
  '%Only a document%status%may be changed%',
  'a browser client cannot reassign a document''s owner_id'
);
select throws_like(
  $$ update m5.documents set status = 'exported' where id = 'c0000000-0000-0000-0000-000000000501'::uuid $$,
  '%pending_review to reviewed%',
  'a browser client cannot jump documents.status to an arbitrary value — only pending_review -> reviewed'
);

select * from finish();
rollback;
