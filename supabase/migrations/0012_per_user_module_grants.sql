-- Two-tier entitlements: org plan vs. per-user grant.
--
-- WHY THIS EXISTS
-- Until now platform.has_module(user, module) resolved ONLY at the org level: if the org's
-- plan (or an override) grants a module, every member of that org gets it. There was no way
-- to say "this org pays for M4 and M5, but only Sara should be able to open M5" — every
-- member either has everything the org pays for, or nothing.
--
-- This migration splits that into two tiers:
--   Tier 1 — platform.org_has_module(org, module): does the ORG pay for this module at all
--            (plan_modules + org_module_overrides, exactly the logic has_module used to have).
--   Tier 2 — platform.has_module(user, module): does this USER, specifically, get to open it —
--            true only if their org is entitled AND (they are an owner/admin, who always get
--            everything their org pays for, OR there is an explicit
--            platform.user_module_grants row for them).
--
-- has_module()'s SIGNATURE IS UNCHANGED. Every m5 RLS policy and supabase/functions/_shared/
-- entitlements.ts::requireModule() calls `platform.has_module(auth.uid(), 'm5')` — none of
-- them need to change for per-user grants to take effect.
--
-- CRITICAL ORDERING: table creation, the backfill, and the has_module() rewrite all live in
-- THIS ONE FILE. The Supabase CLI wraps each migration file in a single transaction; splitting
-- these across files would open a window where has_module() is already two-tier-only but no
-- grant rows exist yet, revoking m5 (and everything else) from every existing pilot member the
-- instant the function is replaced. Do not split this file.

-- ── the grant table ──────────────────────────────────────────────────────────

create table platform.user_module_grants (
  org_id uuid not null,
  user_id uuid not null,
  module_id text not null references platform.modules(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (org_id, user_id, module_id),
  -- Deliberately FK'd to the (org_id, user_id) PAIR on org_members, not user_id alone: when
  -- someone is removed from an org, their grants for that org disappear with them (ON DELETE
  -- CASCADE), so being re-added later starts from zero grants rather than silently reviving
  -- old access.
  foreign key (org_id, user_id) references platform.org_members(org_id, user_id) on delete cascade
);

comment on table platform.user_module_grants is
  'Tier 2 of module entitlement: which of an org''s ENTITLED modules a specific member may '
  'open. A row here is meaningless (and rejected by guard_user_module_grant) unless '
  'platform.org_has_module(org_id, module_id) is also true — a user can never be granted '
  'something their org does not pay for.';

-- A user cannot be granted a module their org isn't entitled to. Checked on INSERT/UPDATE
-- only — if an org's plan or override later changes such that org_has_module() flips false,
-- existing grant rows are left in place (harmless: has_module() re-checks org_has_module()
-- every call) rather than being swept, so restoring the entitlement instantly restores exactly
-- who had access before, with no need to re-grant anyone by hand.
create or replace function platform.guard_user_module_grant()
returns trigger
language plpgsql
security definer
set search_path = platform, public
as $$
begin
  if not platform.org_has_module(new.org_id, new.module_id) then
    raise exception 'Org % is not entitled to module %; cannot grant it to a user.',
      new.org_id, new.module_id;
  end if;
  if new.granted_by is null then
    new.granted_by := auth.uid();
  end if;
  return new;
end;
$$;

-- (org_has_module is created below, before this trigger is attached, so the reference
-- resolves at attach time as well as call time — plpgsql bodies are validated lazily, but
-- there's no reason to rely on that here when the ordering costs nothing.)

-- ── tier 1: what the ORG pays for ────────────────────────────────────────────
-- Exactly 0001's original has_module() logic, minus the per-user OR-across-orgs part: given
-- one org, does its override (if any) or its plan grant this module. An override's `granted`
-- value always wins over the plan, same as before.

create or replace function platform.org_has_module(p_org uuid, p_module text)
returns boolean
language sql
stable
security definer
set search_path = platform, public
as $$
  select coalesce(
    (select omo.granted
       from platform.org_module_overrides omo
      where omo.org_id = p_org and omo.module_id = p_module),
    coalesce(
      (select s.status in ('trial', 'active')
              and exists (
                select 1 from platform.plan_modules pm
                where pm.plan_id = s.plan_id and pm.module_id = p_module
              )
         from platform.org_subscriptions s
        where s.org_id = p_org),
      false
    )
  );
$$;

grant execute on function platform.org_has_module(uuid, text) to authenticated;

-- Now that org_has_module exists, attach the guard trigger.
drop trigger if exists guard_user_module_grant on platform.user_module_grants;
create trigger guard_user_module_grant
  before insert or update on platform.user_module_grants
  for each row execute function platform.guard_user_module_grant();

-- ── backfill — before the has_module rewrite, in the same transaction ───────
-- Every existing member of an org gets an explicit grant row for every module their org is
-- currently entitled to, so the moment has_module() below starts requiring tier-2 grants,
-- nobody's access changes. (Owners/admins don't strictly need a row — has_module() always
-- grants them everything their org has — but backfilling them too keeps
-- org_module_matrix's "effective" column consistent and gives them something to see/edit
-- immediately in the admin UI rather than an empty-looking grid.)

insert into platform.user_module_grants (org_id, user_id, module_id, granted_by)
select m.org_id, m.user_id, mod.id, m.user_id
  from platform.org_members m
  cross join platform.modules mod
 where platform.org_has_module(m.org_id, mod.id)
on conflict do nothing;

-- ── tier 2: what a USER may open ─────────────────────────────────────────────
-- SAME SIGNATURE as before: has_module(uuid, text). Every existing caller keeps working.
-- Owners and admins always get everything their org is entitled to — otherwise an owner who
-- forgets to grant themselves a module could lock themselves out of the very admin screen
-- that grants modules, with no recovery short of the SQL editor. Members and viewers need an
-- explicit user_module_grants row.

create or replace function platform.has_module(p_user uuid, p_module text)
returns boolean
language sql
stable
security definer
set search_path = platform, public
as $$
  select exists (
    select 1
      from platform.org_members m
     where m.user_id = p_user
       and platform.org_has_module(m.org_id, p_module)
       and (
         m.role in ('owner', 'admin')
         or exists (
           select 1 from platform.user_module_grants g
            where g.org_id = m.org_id and g.user_id = p_user and g.module_id = p_module
         )
       )
  );
$$;

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table platform.user_module_grants enable row level security;

create policy user_module_grants_read on platform.user_module_grants for select to authenticated
  using (org_id in (select platform.my_org_ids()) or platform.is_platform_admin());

create policy user_module_grants_admin_write on platform.user_module_grants for insert to authenticated
  with check (platform.is_org_admin(org_id));

create policy user_module_grants_admin_delete on platform.user_module_grants for delete to authenticated
  using (platform.is_org_admin(org_id));

-- No UPDATE policy: a grant is either present or absent, never edited in place — the admin
-- UI (platform.set_user_modules below) deletes and re-inserts rather than updating a row.

grant select, insert, delete on platform.user_module_grants to authenticated;

-- ── admin-facing read/write RPCs ─────────────────────────────────────────────
-- All three check authorization *inside the body* rather than relying solely on RLS, because
-- they're meant to be called by both an org admin (their own org only) and platform staff
-- (any org) — a single `security definer` function with an explicit check reads more clearly
-- than trying to express "org admin of THIS org, or any platform admin" as a table policy on
-- every table it touches.

-- "What does this org pay for" — powers the admin UI's plan/override view. `source` tells the
-- UI whether a module is entitled via the plan, a manual override, or not at all.
create or replace function platform.org_entitlements(p_org uuid)
returns table (module_id text, name text, status text, entitled boolean, source text)
language plpgsql
stable
security definer
set search_path = platform, public
as $$
begin
  if not (platform.is_org_admin(p_org) or platform.is_platform_admin()) then
    raise exception 'Not authorized for org %.', p_org;
  end if;
  return query
    select mod.id, mod.name, mod.status,
           platform.org_has_module(p_org, mod.id) as entitled,
           case
             when exists (
               select 1 from platform.org_module_overrides omo
                where omo.org_id = p_org and omo.module_id = mod.id
             ) then 'override'
             when exists (
               select 1 from platform.org_subscriptions s
               join platform.plan_modules pm on pm.plan_id = s.plan_id
                where s.org_id = p_org and pm.module_id = mod.id
                  and s.status in ('trial', 'active')
             ) then 'plan'
             else 'none'
           end as source
      from platform.modules mod
     order by mod.sort_order;
end;
$$;

-- The member × module grid the org page and the staff console both render.
create or replace function platform.org_module_matrix(p_org uuid)
returns table (
  user_id uuid, email text, role text, module_id text,
  org_entitled boolean, user_granted boolean, effective boolean
)
language plpgsql
stable
security definer
set search_path = platform, public
as $$
begin
  if not (platform.is_org_admin(p_org) or platform.is_platform_admin()) then
    raise exception 'Not authorized for org %.', p_org;
  end if;
  return query
    select m.user_id, u.email, m.role, mod.id as module_id,
           platform.org_has_module(p_org, mod.id) as org_entitled,
           exists (
             select 1 from platform.user_module_grants g
              where g.org_id = p_org and g.user_id = m.user_id and g.module_id = mod.id
           ) as user_granted,
           platform.has_module(m.user_id, mod.id) as effective
      from platform.org_members m
      join auth.users u on u.id = m.user_id
      cross join platform.modules mod
     where m.org_id = p_org
     order by u.email, mod.sort_order;
end;
$$;

-- Internal, unchecked core of set_user_modules — no authorization check, callable from
-- trigger/provisioning contexts where there is no acting JWT (auth.uid() is null on an
-- auth.users trigger and during invite self-redemption at signup, so is_org_admin()/
-- is_platform_admin() would always evaluate false there and reject a legitimate system
-- call). Every caller from the browser goes through platform.set_user_modules(), which
-- checks authorization and then delegates here.
--
-- CRITICAL: PostgreSQL grants EXECUTE on a new function to PUBLIC by default — unlike
-- tables, which start with no privileges at all. Without the explicit REVOKE below, any
-- `authenticated` PostgREST caller could invoke this directly via
-- `/rest/v1/rpc/set_user_modules_unchecked` and grant themselves (or anyone) any module
-- their org is entitled to, completely bypassing the is_org_admin() check that
-- set_user_modules() exists to enforce.
create or replace function platform.set_user_modules_unchecked(
  p_org uuid, p_user uuid, p_module_ids text[], p_granted_by uuid
)
returns void
language plpgsql
security definer
set search_path = platform, public
as $$
begin
  if not exists (select 1 from platform.org_members where org_id = p_org and user_id = p_user) then
    raise exception 'User % is not a member of org %.', p_user, p_org;
  end if;

  delete from platform.user_module_grants where org_id = p_org and user_id = p_user;

  insert into platform.user_module_grants (org_id, user_id, module_id, granted_by)
  select p_org, p_user, mod_id, p_granted_by
    from unnest(p_module_ids) as mod_id
   where platform.org_has_module(p_org, mod_id)
  on conflict do nothing;
end;
$$;

revoke execute on function platform.set_user_modules_unchecked(uuid, uuid, text[], uuid) from public;
-- service_role needs this to call it from admin-api (staff writes) and from provision_user/
-- redeem_my_invites (0013), both of which run as whatever role the trigger/RPC context
-- provides — 0007's ALTER DEFAULT PRIVILEGES already covers service_role for every function
-- created in this schema from here on, so no explicit grant is needed for that role; this
-- REVOKE only removes the PUBLIC default, it does not need a matching GRANT.

-- Replaces one member's entire grant set for the org in one transaction (delete-then-insert),
-- so the admin UI can save a whole row of checkboxes as a single call instead of one
-- insert/delete per checkbox. Silently drops any module_id the org isn't entitled to rather
-- than erroring — the UI only ever offers entitled modules as checkboxes, so this is a safety
-- net, not the primary validation (guard_user_module_grant is that).
create or replace function platform.set_user_modules(p_org uuid, p_user uuid, p_module_ids text[])
returns void
language plpgsql
security definer
set search_path = platform, public
as $$
begin
  if not (platform.is_org_admin(p_org) or platform.is_platform_admin()) then
    raise exception 'Not authorized for org %.', p_org;
  end if;
  perform platform.set_user_modules_unchecked(p_org, p_user, p_module_ids, auth.uid());
end;
$$;

grant execute on function platform.org_entitlements(uuid) to authenticated;
grant execute on function platform.org_module_matrix(uuid) to authenticated;
grant execute on function platform.set_user_modules(uuid, uuid, text[]) to authenticated;

-- platform.my_modules() (0001) needs no change: it already calls
-- has_module(auth.uid(), m.id), so it inherits two-tier resolution for free. Likewise
-- packages/entitlements/src/lib/entitlements/{useEntitlements.ts,RequireModule.tsx} need no
-- change on the frontend.
