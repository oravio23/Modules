-- Fixes for three defects found auditing 0010-0014 after they landed.
--
-- ── 1. guard_org_member_write blocked every FK cascade delete ────────────────
-- 0010's guard raises "An org must keep at least one owner." on any DELETE of an owner's
-- org_members row. platform.org_members has TWO `on delete cascade` foreign keys (0001:26-27,
-- to auth.users and platform.orgs), and a cascade performs a real row DELETE that fires this
-- BEFORE ROW trigger — which then aborted the whole parent statement.
--
-- Because 0013's provision_user makes every self-serve signup the SOLE owner of a personal
-- org, the practical effect was: NO user could ever be deleted (Studio's "Delete user",
-- auth.admin.deleteUser(), any GDPR erasure job) and NO org with an owner could be deleted —
-- not even as superuser, since the trigger is not privilege-gated. Deleting the org_members
-- row first to work around it hit the same guard. There was no recovery path short of
-- disabling the trigger by hand.
--
-- The guard is only ever meant to stop a DIRECT demotion/removal that would strip an org of
-- its last owner. When the parent user or parent org is itself being deleted, "this org keeps
-- an owner" is meaningless — the org is going away too (or the human is). pg_trigger_depth()
-- distinguishes the two: a statement the caller issued runs this trigger at depth 1; a cascade
-- runs Postgres' internal RI trigger at depth 1 and ours at depth 2.

create or replace function platform.guard_org_member_write()
returns trigger
language plpgsql
security definer
set search_path = platform, public
as $$
declare
  v_owner_count int;
begin
  -- A cascade from auth.users or platform.orgs — not a direct membership edit. Let it through;
  -- see this migration's header for why the last-owner rule cannot apply here.
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;

  if tg_op in ('UPDATE', 'DELETE') and old.user_id = auth.uid() and not platform.is_platform_admin() then
    raise exception 'You cannot change your own membership row.';
  end if;

  if tg_op = 'UPDATE' and old.role = 'owner' and new.role <> 'owner' then
    select count(*) into v_owner_count
      from platform.org_members
     where org_id = old.org_id and role = 'owner' and user_id <> old.user_id;
    if v_owner_count = 0 then
      raise exception 'An org must keep at least one owner.';
    end if;
  end if;

  if tg_op = 'DELETE' and old.role = 'owner' then
    select count(*) into v_owner_count
      from platform.org_members
     where org_id = old.org_id and role = 'owner' and user_id <> old.user_id;
    if v_owner_count = 0 then
      raise exception 'An org must keep at least one owner.';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- ── 2. 0014 only guarded two of M5's write paths ─────────────────────────────
-- 0014 added guards for UPDATE on m5.documents and review_state changes on m5.extractions,
-- and its header claimed viewers "lose write access [they] never should have had". That was
-- an overclaim: 0003 grants `select, insert, update, delete` on every m5 table to
-- `authenticated`, and the m5 schema is PostgREST-exposed (config.toml [api].schemas), so a
-- viewer holding an m5 grant could still, with nothing but their own JWT and the anon key:
--   * DELETE a document — cascading away its parts, jobs, extractions and field_results;
--   * PATCH extractions.envelope (0014 only inspected review_state transitions), which
--     export-result reads back verbatim — letting a viewer rewrite exported content;
--   * PATCH field_results (value / human_value / human_action) — no guard at all;
--   * delete or overwrite objects in the `documents` storage bucket, whose policy is FOR ALL.
-- One shared assert_writer() now covers all of them.

create or replace function m5.assert_writer(p_org uuid)
returns void
language plpgsql
security definer
set search_path = m5, platform, public
as $$
declare
  v_role text;
begin
  -- No acting JWT means this is the pipeline / an edge function on the service-role key,
  -- which legitimately drives every one of these tables. Same exemption 0014 already used.
  if auth.uid() is null then
    return;
  end if;
  v_role := platform.my_role_in(p_org);
  if v_role is null or v_role = 'viewer' then
    raise exception 'Viewers cannot modify M5 data.';
  end if;
end;
$$;

revoke execute on function m5.assert_writer(uuid) from public;

-- documents: DELETE (UPDATE already guarded by 0014's guard_document_client_update)
create or replace function m5.guard_document_delete()
returns trigger
language plpgsql
security definer
set search_path = m5, platform, public
as $$
begin
  perform m5.assert_writer(old.org_id);
  return old;
end;
$$;

drop trigger if exists guard_document_delete on m5.documents;
create trigger guard_document_delete
  before delete on m5.documents
  for each row execute function m5.guard_document_delete();

-- field_results: the human-review edit surface. Org-scoped by 0003's RLS, but role-blind
-- until now. Resolved through extraction -> document to find the owning org.
create or replace function m5.guard_field_result_write()
returns trigger
language plpgsql
security definer
set search_path = m5, platform, public
as $$
declare
  v_org uuid;
begin
  if auth.uid() is null then
    return new;
  end if;
  select d.org_id into v_org
    from m5.extractions e
    join m5.documents d on d.id = e.document_id
   where e.id = new.extraction_id;
  perform m5.assert_writer(v_org);
  return new;
end;
$$;

drop trigger if exists guard_field_result_write on m5.field_results;
create trigger guard_field_result_write
  before insert or update on m5.field_results
  for each row execute function m5.guard_field_result_write();

-- documents UPDATE: 0014 already guarded this path, but with its own inline role check and
-- its own wording. Re-pointed at assert_writer so every m5 guard shares one helper and one
-- message — the column rules below are 0014's, unchanged.
create or replace function m5.guard_document_client_update()
returns trigger
language plpgsql
security definer
set search_path = m5, platform, public
as $$
begin
  if auth.uid() is null then
    return new; -- service-role / pipeline write
  end if;

  perform m5.assert_writer(new.org_id);

  -- Every column below is pipeline/system-owned. A browser client updating a document is
  -- ALWAYS the human-review action in ReviewWorkspace.tsx ("mark reviewed").
  if new.owner_id is distinct from old.owner_id
     or new.org_id is distinct from old.org_id
     or new.filename is distinct from old.filename
     or new.declared_mime is distinct from old.declared_mime
     or new.detected_mime is distinct from old.detected_mime
     or new.sha256 is distinct from old.sha256
     or new.byte_size is distinct from old.byte_size
     or new.storage_path is distinct from old.storage_path
     or new.anthropic_file_id is distinct from old.anthropic_file_id
     or new.profile_id is distinct from old.profile_id
     or new.profile_confidence is distinct from old.profile_confidence
     or new.language_hints is distinct from old.language_hints
     or new.error_reason is distinct from old.error_reason
     or new.created_at is distinct from old.created_at
  then
    raise exception 'Only a document''s status may be changed from the browser.';
  end if;

  if new.status is distinct from old.status and not (old.status = 'pending_review' and new.status = 'reviewed') then
    raise exception 'documents.status may only move from pending_review to reviewed from the browser.';
  end if;

  return new;
end;
$$;

-- extractions: replace 0014's review_state-only check with one that (a) applies to EVERY
-- browser update, not just review_state transitions, and (b) refuses any browser-side change
-- to `envelope`. The envelope is pipeline output and the exact bytes export-result serves;
-- ReviewWorkspace.tsx only ever writes review_state, so nothing legitimate is lost.
create or replace function m5.guard_extraction_review()
returns trigger
language plpgsql
security definer
set search_path = m5, platform, public
as $$
declare
  v_org_id uuid;
begin
  if auth.uid() is null then
    return new; -- service-role / pipeline write
  end if;

  select d.org_id into v_org_id from m5.documents d where d.id = new.document_id;
  perform m5.assert_writer(v_org_id);

  if new.envelope is distinct from old.envelope then
    raise exception 'The extraction envelope is pipeline output and cannot be edited from the browser.';
  end if;

  return new;
end;
$$;

-- storage: 0003's single FOR ALL policy let any entitled member (viewer included) delete or
-- overwrite another member's uploaded originals. Split into read-for-all-entitled and
-- write-for-non-viewers. Dropped and recreated rather than altered — Postgres has no ALTER
-- POLICY for the predicate itself.
drop policy if exists m5_documents_bucket_org_scoped on storage.objects;

create policy m5_documents_bucket_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1]::uuid in (select platform.my_org_ids())
    and platform.has_module(auth.uid(), 'm5')
  );

create policy m5_documents_bucket_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1]::uuid in (select platform.my_org_ids())
    and platform.has_module(auth.uid(), 'm5')
    and coalesce(platform.my_role_in((storage.foldername(name))[1]::uuid), '') <> 'viewer'
  );

create policy m5_documents_bucket_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1]::uuid in (select platform.my_org_ids())
    and platform.has_module(auth.uid(), 'm5')
    and coalesce(platform.my_role_in((storage.foldername(name))[1]::uuid), '') <> 'viewer'
  )
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1]::uuid in (select platform.my_org_ids())
    and platform.has_module(auth.uid(), 'm5')
    and coalesce(platform.my_role_in((storage.foldername(name))[1]::uuid), '') <> 'viewer'
  );

create policy m5_documents_bucket_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1]::uuid in (select platform.my_org_ids())
    and platform.has_module(auth.uid(), 'm5')
    and coalesce(platform.my_role_in((storage.foldername(name))[1]::uuid), '') <> 'viewer'
  );

-- ── 3. org_has_module was left PUBLIC-executable ─────────────────────────────
-- 0012 granted it to `authenticated` but never revoked the PUBLIC default, and 0001 gives
-- `anon` USAGE on the platform schema — so an unauthenticated caller who knew an org's UUID
-- could probe its entitlements over PostgREST. Same class of oversight 0012 already fixed
-- for set_user_modules_unchecked; this closes the one it missed.
revoke execute on function platform.org_has_module(uuid, text) from public;
grant execute on function platform.org_has_module(uuid, text) to authenticated;
