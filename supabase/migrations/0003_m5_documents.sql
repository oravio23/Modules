-- M5 Document Intelligence — moved from its own standalone project into the shared
-- platform database, under schema m5 (created in 0002_module_schemas.sql).
-- PROPOSED (Phase 0 governance has not passed its exit gate; see the M5 app's CLAUDE.md §1).
--
-- Ported from the M5 pilot's original supabase/migrations/0001_init.sql, which scoped every
-- table by a bare owner_id = auth.uid(). That model has no concept of a paying customer's
-- organization, so it can't answer "does this ORG still have the Document Intelligence
-- module" — only "did this browser session create the row". Every table below keeps
-- owner_id (still useful: who personally uploaded/reviewed something) and adds org_id as
-- the actual security-scoping column, gated by platform.has_module(auth.uid(), 'm5') exactly
-- like every other module — see 0001_platform_core.sql's has_module()/my_org_ids().

create extension if not exists "pgcrypto";

-- ── Enums ──────────────────────────────────────────────────────────────────

create type m5.document_status as enum (
  'uploaded',       -- registered, parts stored, not yet queued
  'queued',
  'processing',
  'pending_review', -- pipeline finished; awaiting mandatory human review
  'reviewed',
  'exported',
  'failed'
);

create type m5.part_kind as enum ('page', 'sheet', 'slide', 'attachment', 'text');

create type m5.job_stage as enum (
  'register', 'transcribe', 'classify', 'extract', 'anchor', 'validate', 'done'
);

create type m5.job_state as enum ('queued', 'running', 'succeeded', 'failed');

-- status is a five-value enum; requires_review is a SEPARATE boolean, never a sixth status.
create type m5.field_status as enum (
  'extracted', 'missing', 'uncertain', 'conflicting', 'not_applicable'
);

create type m5.validator_outcome as enum ('pass', 'warn', 'fail', 'not_applicable');

create type m5.anchor_state as enum ('verified', 'unverified', 'not_applicable');

create type m5.review_state as enum ('pending', 'in_review', 'approved', 'rejected');

create type m5.profile_status as enum ('PROPOSED', 'READY_FOR_REVIEW', 'APPROVED');

-- ── updated_at helper ──────────────────────────────────────────────────────

create function m5.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ── profiles: document profiles as data ────────────────────────────────────

create table m5.profiles (
  id text primary key,                 -- e.g. 'generic', 'commercial_invoice'
  version text not null,
  status m5.profile_status not null default 'PROPOSED',
  title text not null,
  description text not null,
  schema jsonb not null,               -- JSON Schema 2020-12 for the field set
  prompt text not null,                -- extraction system prompt
  validator_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_set_updated_at before update on m5.profiles
  for each row execute function m5.set_updated_at();

-- ── documents ───────────────────────────────────────────────────────────────

create table m5.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid not null references platform.orgs(id) on delete cascade,
  filename text not null,
  declared_mime text,
  detected_mime text,
  sha256 text not null,
  byte_size bigint not null,
  storage_path text not null,          -- original upload, in the 'documents' bucket
  anthropic_file_id text,              -- whole-file Files API upload (set for PDFs; null when parts carry their own)
  status m5.document_status not null default 'uploaded',
  profile_id text references m5.profiles(id),
  profile_confidence numeric(4,3),
  language_hints text[] not null default '{}',
  error_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index documents_org_idx on m5.documents(org_id, created_at desc);
create index documents_owner_idx on m5.documents(owner_id, created_at desc);
create trigger documents_set_updated_at before update on m5.documents
  for each row execute function m5.set_updated_at();

-- ── document_parts: normalised artifacts (page / sheet / slide / attachment) ─

create table m5.document_parts (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references m5.documents(id) on delete cascade,
  ordinal int not null,
  kind m5.part_kind not null,
  label text,                          -- e.g. "Page 3", "Sheet: Invoice", "Slide 2"
  storage_path text,                   -- normalised artifact (image/text), if any
  mime text,
  width int,
  height int,
  anthropic_file_id text,              -- Files API reference, set once uploaded
  pending_text_layer text,             -- pdf.js cross-check text stashed at registration for 'page' parts;
                                        -- consumed by the transcribe stage into transcripts.text_layer once the
                                        -- authoritative (model) transcript is written — 'page' parts have no
                                        -- transcript row at all until then (transcripts.text is NOT NULL).
  created_at timestamptz not null default now(),
  unique (document_id, ordinal)
);
create index document_parts_document_idx on m5.document_parts(document_id);

-- ── transcripts: verbatim text per part ─────────────────────────────────────

create table m5.transcripts (
  id uuid primary key default gen_random_uuid(),
  part_id uuid not null references m5.document_parts(id) on delete cascade,
  text text not null,
  text_layer text,                     -- pdf.js-extracted text layer, if available, for cross-check
  direction text not null default 'ltr' check (direction in ('ltr', 'rtl', 'auto')),
  languages text[] not null default '{}',
  tables jsonb not null default '[]',  -- reconstructed markdown/array tables, if any
  created_at timestamptz not null default now(),
  unique (part_id)
);

-- ── jobs: pipeline state machine ────────────────────────────────────────────

create table m5.jobs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references m5.documents(id) on delete cascade,
  stage m5.job_stage not null default 'register',
  state m5.job_state not null default 'queued',
  attempts int not null default 0,
  max_attempts int not null default 5,
  progress_current int not null default 0,
  progress_total int not null default 0,
  last_error text,
  run_after timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index jobs_pending_idx on m5.jobs(state, run_after) where state in ('queued', 'running');
create index jobs_document_idx on m5.jobs(document_id);
create trigger jobs_set_updated_at before update on m5.jobs
  for each row execute function m5.set_updated_at();

-- ── extractions: one Result Envelope per (document, profile) run ───────────

create table m5.extractions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references m5.documents(id) on delete cascade,
  profile_id text not null references m5.profiles(id),
  profile_version text not null,
  envelope jsonb not null,             -- the full Result Envelope, schema-validated before insert
  usage_json jsonb not null default '{}',
  validation_summary jsonb not null default '{}',
  review_state m5.review_state not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index extractions_document_idx on m5.extractions(document_id, created_at desc);
create trigger extractions_set_updated_at before update on m5.extractions
  for each row execute function m5.set_updated_at();

-- ── field_results: flattened per-field rows for the review UI ──────────────

create table m5.field_results (
  id uuid primary key default gen_random_uuid(),
  extraction_id uuid not null references m5.extractions(id) on delete cascade,
  field_path text not null,            -- e.g. "line_items[2].unit_price", "grand_total"
  field_label text not null,
  value jsonb,
  status m5.field_status not null,
  requires_review boolean not null default true,
  confidence numeric(4,3),
  evidence jsonb not null default '[]',   -- [{ part_ordinal, quote, char_start, char_end, anchor }]
  validator_results jsonb not null default '[]',
  notes text,
  human_value jsonb,
  human_action text check (human_action in ('accepted', 'edited', 'rejected')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index field_results_extraction_idx on m5.field_results(extraction_id);

-- ── audit_log: every human and system action ────────────────────────────────

create table m5.audit_log (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references m5.documents(id) on delete cascade,
  extraction_id uuid references m5.extractions(id) on delete cascade,
  actor_id uuid references auth.users(id),
  actor_kind text not null check (actor_kind in ('human', 'system')),
  action text not null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_log_document_idx on m5.audit_log(document_id, created_at desc);

-- ── Row Level Security ───────────────────────────────────────────────────────

alter table m5.documents enable row level security;
alter table m5.document_parts enable row level security;
alter table m5.transcripts enable row level security;
alter table m5.jobs enable row level security;
alter table m5.extractions enable row level security;
alter table m5.field_results enable row level security;
alter table m5.audit_log enable row level security;
alter table m5.profiles enable row level security;

-- profiles: readable by anyone entitled to the module, writable only via service role.
create policy profiles_select_entitled on m5.profiles
  for select to authenticated using (platform.has_module(auth.uid(), 'm5'));

-- documents: org-scoped AND entitlement-gated. platform.has_module() is not optional here —
-- without it, a user whose org's subscription lapses keeps reading their old documents
-- through direct table access even though the hub no longer shows them the module at all.
create policy documents_org_select on m5.documents
  for select to authenticated using (
    org_id in (select platform.my_org_ids()) and platform.has_module(auth.uid(), 'm5')
  );
create policy documents_org_insert on m5.documents
  for insert to authenticated with check (
    owner_id = auth.uid()
    and org_id in (select platform.my_org_ids())
    and platform.has_module(auth.uid(), 'm5')
  );
create policy documents_org_update on m5.documents
  for update to authenticated using (
    org_id in (select platform.my_org_ids()) and platform.has_module(auth.uid(), 'm5')
  );
create policy documents_org_delete on m5.documents
  for delete to authenticated using (
    org_id in (select platform.my_org_ids()) and platform.has_module(auth.uid(), 'm5')
  );

-- document_parts / transcripts / jobs / extractions / field_results / audit_log:
-- scoped through the owning document, repeating the same org+entitlement check explicitly
-- rather than relying on m5.documents' own RLS to filter the join. Writes to
-- pipeline-managed tables happen via the service-role key inside edge functions, which
-- bypasses RLS — these policies govern browser (authenticated) access only.
create policy document_parts_org_select on m5.document_parts
  for select to authenticated using (
    exists (
      select 1 from m5.documents d
      where d.id = document_parts.document_id
        and d.org_id in (select platform.my_org_ids())
    ) and platform.has_module(auth.uid(), 'm5')
  );

create policy transcripts_org_select on m5.transcripts
  for select to authenticated using (
    exists (
      select 1 from m5.document_parts p
      join m5.documents d on d.id = p.document_id
      where p.id = transcripts.part_id
        and d.org_id in (select platform.my_org_ids())
    ) and platform.has_module(auth.uid(), 'm5')
  );

create policy jobs_org_select on m5.jobs
  for select to authenticated using (
    exists (
      select 1 from m5.documents d
      where d.id = jobs.document_id
        and d.org_id in (select platform.my_org_ids())
    ) and platform.has_module(auth.uid(), 'm5')
  );

create policy extractions_org_select on m5.extractions
  for select to authenticated using (
    exists (
      select 1 from m5.documents d
      where d.id = extractions.document_id
        and d.org_id in (select platform.my_org_ids())
    ) and platform.has_module(auth.uid(), 'm5')
  );
create policy extractions_org_update on m5.extractions
  for update to authenticated using (
    exists (
      select 1 from m5.documents d
      where d.id = extractions.document_id
        and d.org_id in (select platform.my_org_ids())
    ) and platform.has_module(auth.uid(), 'm5')
  );

create policy field_results_org_select on m5.field_results
  for select to authenticated using (
    exists (
      select 1 from m5.extractions e
      join m5.documents d on d.id = e.document_id
      where e.id = field_results.extraction_id
        and d.org_id in (select platform.my_org_ids())
    ) and platform.has_module(auth.uid(), 'm5')
  );
-- Human review actions (accept/edit/reject) are written by any org member directly.
create policy field_results_org_update on m5.field_results
  for update to authenticated using (
    exists (
      select 1 from m5.extractions e
      join m5.documents d on d.id = e.document_id
      where e.id = field_results.extraction_id
        and d.org_id in (select platform.my_org_ids())
    ) and platform.has_module(auth.uid(), 'm5')
  );

create policy audit_log_org_select on m5.audit_log
  for select to authenticated using (
    exists (
      select 1 from m5.documents d
      where d.id = audit_log.document_id
        and d.org_id in (select platform.my_org_ids())
    ) and platform.has_module(auth.uid(), 'm5')
  );
create policy audit_log_org_insert on m5.audit_log
  for insert to authenticated with check (
    exists (
      select 1 from m5.documents d
      where d.id = audit_log.document_id
        and d.org_id in (select platform.my_org_ids())
    ) and platform.has_module(auth.uid(), 'm5')
  );

-- ── Grants — RLS is checked *after* GRANTs, so both are required ────────────

grant usage on schema m5 to authenticated;
grant select, insert, update, delete on all tables in schema m5 to authenticated;
alter default privileges in schema m5 grant select, insert, update, delete on tables to authenticated;

-- ── Storage ──────────────────────────────────────────────────────────────────
-- Bucket name kept as 'documents' from the original M5 pilot — Storage buckets aren't
-- Postgres-schema-scoped, so this doesn't collide with anything under the m5 schema.

insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 524288000)
on conflict (id) do nothing;

-- Policy name prefixed m5_ (unlike the table policies above) because storage.objects is a
-- single shared table across every module that uses Storage, not namespaced per schema —
-- an unprefixed name here could collide with another module's own storage policy later.
-- Paths are `${org_id}/${uploadId}/...` (see src/lib/org.ts + uploadDocument.ts), so the
-- first folder segment is checked against the caller's org membership instead of their own
-- user id, matching the org_id-based table RLS above.
create policy m5_documents_bucket_org_scoped on storage.objects
  for all to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1]::uuid in (select platform.my_org_ids())
    and platform.has_module(auth.uid(), 'm5')
  )
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1]::uuid in (select platform.my_org_ids())
    and platform.has_module(auth.uid(), 'm5')
  );

-- ── Realtime ─────────────────────────────────────────────────────────────────

alter publication supabase_realtime add table m5.jobs;
alter publication supabase_realtime add table m5.documents;
