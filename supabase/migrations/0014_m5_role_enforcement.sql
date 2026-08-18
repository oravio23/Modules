-- M5 role enforcement — closes docs/hub-v1-contract-audit.md §7's two concrete findings:
--   1. "extractions_org_update lets any org member set review_state='approved', and that
--      flag is the sole export gate — 'some human approved this', not 'an authorised
--      reviewer approved this'."
--   2. "documents_org_update restricts no columns — a browser client can set
--      documents.status or reassign owner_id."
--
-- WHY VIEWER, NOT ADMIN-ONLY
-- The obvious-looking fix — require is_org_admin() to approve/reject — would break M5's
-- actual product shape: ordinary team members are the reviewers in this workflow, not just
-- org admins (apps/m5-documents/src/components/review/ReviewWorkspace.tsx has no separate
-- "reviewer" concept; any member does the review today). The narrower, product-correct
-- enforcement of "role" is excluding 'viewer' specifically — that role exists precisely to
-- mean read-only, and today it isn't. member/admin/owner can still approve/reject/mark
-- reviewed, exactly as before; only viewer loses write access it was never supposed to have.
--
-- WHY A TRIGGER, NOT A NARROWER RLS POLICY OR COLUMN GRANT
-- Both guards need to distinguish a BROWSER write (an end user's own JWT, auth.uid() not
-- null) from a SYSTEM write (documents-register / pipeline-worker, using the service-role
-- key, auth.uid() null) — the pipeline legitimately drives documents.status through every
-- other transition (queued -> processing -> pending_review -> exported -> failed) and sets
-- anthropic_file_id, profile_id, etc. RLS policies can't see "is this the service role"
-- cleanly the way a trigger checking auth.uid() can, and a column-level GRANT can't express
-- "this column may change, but only from THIS value to THAT one." Both triggers early-return
-- for auth.uid() is null, so the pipeline's own writes are completely unaffected.

create or replace function m5.guard_extraction_review()
returns trigger
language plpgsql
security definer
set search_path = m5, platform, public
as $$
declare
  v_org_id uuid;
  v_role text;
begin
  if auth.uid() is null then
    return new; -- service-role / pipeline write, not a browser client — not subject to this guard
  end if;

  if new.review_state is distinct from old.review_state and new.review_state in ('approved', 'rejected') then
    select d.org_id into v_org_id from m5.documents d where d.id = new.document_id;
    v_role := platform.my_role_in(v_org_id);
    if v_role is null or v_role = 'viewer' then
      raise exception 'Only an org member (not a viewer) may approve or reject an extraction.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_extraction_review on m5.extractions;
create trigger guard_extraction_review
  before update on m5.extractions
  for each row execute function m5.guard_extraction_review();

create or replace function m5.guard_document_client_update()
returns trigger
language plpgsql
security definer
set search_path = m5, platform, public
as $$
declare
  v_role text;
begin
  if auth.uid() is null then
    return new; -- service-role / pipeline write — not subject to this guard
  end if;

  v_role := platform.my_role_in(new.org_id);
  if v_role is null or v_role = 'viewer' then
    raise exception 'Viewers cannot modify documents.';
  end if;

  -- Every column below is pipeline/system-owned. A browser client updating a document is
  -- ALWAYS the human-review action in ReviewWorkspace.tsx ("mark reviewed") — nothing else
  -- in the app writes to this table from the browser. Locking everything but that one
  -- transition is what closes "a browser client can set documents.status or reassign
  -- owner_id" without narrowing what the pipeline itself is allowed to do.
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

drop trigger if exists guard_document_client_update on m5.documents;
create trigger guard_document_client_update
  before update on m5.documents
  for each row execute function m5.guard_document_client_update();
