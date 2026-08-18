-- Oravio staff — platform-wide admin access.
--
-- WHY THIS EXISTS
-- There is no way today for Oravio staff to see or manage a customer's org, subscription, or
-- module access without the Supabase SQL editor. This adds the staff flag and lets staff READ
-- every org-scoped row through RLS. Staff WRITES (changing a plan, granting an override,
-- reassigning a member) deliberately do NOT get a blanket RLS policy — see the note below —
-- and instead go through the admin-api edge function using the service-role key, which is
-- where every staff write gets an audit_log row. That split is why this migration only ever
-- widens SELECT policies, never INSERT/UPDATE/DELETE ones, on orgs/org_members/
-- org_subscriptions/org_module_overrides.
--
-- Becoming staff has exactly one path: a service-role INSERT into platform.platform_admins,
-- e.g. from the SQL editor —
--   insert into platform.platform_admins (user_id, note)
--   select id, 'founder' from auth.users where email = 'jad.assaf@oravio.co';
-- No RLS policy below grants authenticated INSERT/UPDATE/DELETE on this table, and no edge
-- function writes to it either. That is deliberate: nothing served by the app can ever create
-- a new platform admin.

create table platform.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now(),
  note text
);

create or replace function platform.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = platform, public
as $$
  select exists (
    select 1 from platform.platform_admins where user_id = auth.uid()
  );
$$;

grant execute on function platform.is_platform_admin() to authenticated;

alter table platform.platform_admins enable row level security;

-- Staff can see who else is staff (useful for an "internal team" list in the console);
-- nobody else can see this table exists has any rows.
create policy platform_admins_self_read on platform.platform_admins for select to authenticated
  using (platform.is_platform_admin());

grant select on platform.platform_admins to authenticated;

-- ── widen existing read policies so staff can see every org, not just their own ────────────
-- Each of these replaces an 0001 policy with the same USING clause plus
-- `or platform.is_platform_admin()`. Postgres has no ALTER POLICY for the predicate itself,
-- so each is dropped and recreated; the policy names are unchanged.

drop policy if exists orgs_member_read on platform.orgs;
create policy orgs_member_read on platform.orgs for select to authenticated
  using (id in (select platform.my_org_ids()) or platform.is_platform_admin());

drop policy if exists org_members_read on platform.org_members;
create policy org_members_read on platform.org_members for select to authenticated
  using (org_id in (select platform.my_org_ids()) or platform.is_platform_admin());

drop policy if exists org_subscriptions_read on platform.org_subscriptions;
create policy org_subscriptions_read on platform.org_subscriptions for select to authenticated
  using (org_id in (select platform.my_org_ids()) or platform.is_platform_admin());

drop policy if exists org_module_overrides_read on platform.org_module_overrides;
create policy org_module_overrides_read on platform.org_module_overrides for select to authenticated
  using (org_id in (select platform.my_org_ids()) or platform.is_platform_admin());

-- ── audit log for staff writes ───────────────────────────────────────────────
-- Every admin-api action appends here before or after the write it performs. Append-only:
-- staff can read, nobody (including staff, via their own JWT) can write — only service_role,
-- via admin-api, can.

create table platform.admin_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_org uuid references platform.orgs(id) on delete set null,
  target_user uuid references auth.users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table platform.admin_audit enable row level security;

create policy admin_audit_staff_read on platform.admin_audit for select to authenticated
  using (platform.is_platform_admin());

-- 0007's ALTER DEFAULT PRIVILEGES already covers service_role on every table/sequence
-- created in the platform schema from here on, including this one; these two grants are the
-- authenticated-role privileges 0007 deliberately doesn't touch.
grant select on platform.admin_audit to authenticated;
grant select, insert on platform.admin_audit to service_role;
