-- M5 role enforcement (0014 + 0015) — see supabase/tests/database/README.md for conventions.
--
-- 0014 originally guarded only UPDATE on m5.documents and review_state transitions on
-- m5.extractions. 0015 closed the rest: DELETE on documents, all writes to field_results,
-- any browser edit of extractions.envelope, and the storage bucket's write paths. The
-- assertions below cover each of those, so a future change that re-opens one fails here.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

-- ── fixtures ──────────────────────────────────────────────────────────────────
insert into platform.orgs (id, name, slug) values
  ('a0000000-0000-0000-0000-000000000501'::uuid, 'Org H', 'test-org-h-06');
-- ON CONFLICT DO UPDATE: supabase/seed.sql's dev_auto_subscribe trigger already
-- auto-subscribed org H to 'full' the instant it was created above.
insert into platform.org_subscriptions (org_id, plan_id, status) values
  ('a0000000-0000-0000-0000-000000000501'::uuid, 'full', 'active')
on conflict (org_id) do update set plan_id = excluded.plan_id, status = excluded.status;

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
insert into m5.field_results (id, extraction_id, field_path, field_label, value, status)
values (
  'e0000000-0000-0000-0000-000000000501'::uuid, 'd0000000-0000-0000-0000-000000000501'::uuid,
  'grand_total', 'Grand total', '"100.00"'::jsonb, 'extracted'::m5.field_status
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
select lives_ok(
  $$ update m5.field_results set human_value = '"120.00"'::jsonb, human_action = 'edited'
      where id = 'e0000000-0000-0000-0000-000000000501'::uuid $$,
  'a plain member can record a human review edit on a field_result'
);

-- ── nobody can rewrite the extraction envelope from the browser (0015) ──────────────────────
-- The envelope is pipeline output and the exact bytes export-result serves back; letting a
-- client PATCH it would make "approved" meaningless.
select throws_like(
  $$ update m5.extractions set envelope = '{"tampered":true}'::jsonb
      where id = 'd0000000-0000-0000-0000-000000000501'::uuid $$,
  '%envelope is pipeline output%',
  'even a member cannot edit extractions.envelope from the browser'
);

reset role;
reset "request.jwt.claims";

-- reset fixtures back to pending for the viewer assertions below
update m5.extractions set review_state = 'pending' where id = 'd0000000-0000-0000-0000-000000000501'::uuid;
update m5.documents set status = 'pending_review' where id = 'c0000000-0000-0000-0000-000000000501'::uuid;

-- ── a viewer cannot write anything in m5, matching the role's read-only name ────────────────
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"b0000000-0000-0000-0000-000000000503","role":"authenticated"}';

select throws_like(
  $$ update m5.extractions set review_state = 'approved' where id = 'd0000000-0000-0000-0000-000000000501'::uuid $$,
  '%Viewers cannot modify M5 data%',
  'a viewer cannot approve an extraction'
);
select throws_like(
  $$ update m5.documents set status = 'reviewed' where id = 'c0000000-0000-0000-0000-000000000501'::uuid $$,
  '%Viewers cannot modify M5 data%',
  'a viewer cannot mark a document reviewed'
);
select throws_like(
  $$ delete from m5.documents where id = 'c0000000-0000-0000-0000-000000000501'::uuid $$,
  '%Viewers cannot modify M5 data%',
  'a viewer cannot DELETE a document (which would cascade away its parts, jobs and extractions)'
);
select throws_like(
  $$ update m5.field_results set human_value = '"999.00"'::jsonb
      where id = 'e0000000-0000-0000-0000-000000000501'::uuid $$,
  '%Viewers cannot modify M5 data%',
  'a viewer cannot edit a field_result'
);

-- ── pipeline-owned columns stay closed to every browser client ──────────────────────────────
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
