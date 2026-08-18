-- Role enforcement.
--
-- WHY THIS EXISTS
-- platform.org_members.role has had a CHECK constraint for 'owner'|'admin'|'member'|'viewer'
-- since 0001, but nothing has ever read it except Org.tsx rendering it as a <Badge>. Any
-- signed-in member of an org can currently INSERT/UPDATE/DELETE platform.org_members for
-- that org (0001 granted select only, but never denied write — there was simply no write
-- policy at all, and Postgres RLS with zero policies for a command means "deny", so writes
-- were actually already blocked at the table level; this migration is what makes admin/owner
-- writes possible in the first place, not what closes an existing hole in org_members).
-- The real, exploitable gap this migration does NOT fix is inside m5 (any member can approve
-- an extraction, which is the sole export gate) — that lands in 0014, once has_module() and
-- the plan_id concept it depends on for messaging exist. This migration only lays the
-- reusable role helpers every later migration needs.

-- ── role helpers ─────────────────────────────────────────────────────────────
-- Same SECURITY DEFINER indirection as platform.my_org_ids() (0001) and for the same reason:
-- a caller-scoped policy on org_members cannot subquery org_members directly in its own USING
-- clause without Postgres reporting "infinite recursion detected in policy for relation
-- \"org_members\"". Resolving role state through a function that runs as its owner (bypassing
-- RLS on the table it reads) sidesteps that.

create or replace function platform.my_role_in(p_org uuid)
returns text
language sql
stable
security definer
set search_path = platform, public
as $$
  select role from platform.org_members
   where org_id = p_org and user_id = auth.uid();
$$;

create or replace function platform.is_org_admin(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = platform, public
as $$
  select coalesce(platform.my_role_in(p_org) in ('owner', 'admin'), false);
$$;

create or replace function platform.is_org_owner(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = platform, public
as $$
  select coalesce(platform.my_role_in(p_org) = 'owner', false);
$$;

grant execute on function platform.my_role_in(uuid) to authenticated;
grant execute on function platform.is_org_admin(uuid) to authenticated;
grant execute on function platform.is_org_owner(uuid) to authenticated;

-- ── guard: cannot self-promote/demote, cannot strip the last owner ──────────
-- Without this, an admin could grant themselves 'owner', or the only owner in an org could
-- demote themselves (or be removed) leaving the org with no one able to manage membership —
-- an unrecoverable state short of the SQL editor.

create or replace function platform.guard_org_member_write()
returns trigger
language plpgsql
security definer
set search_path = platform, public
as $$
declare
  v_owner_count int;
begin
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

-- platform.is_platform_admin() does not exist yet (it lands in 0011, which runs after this
-- file) — declared here as a forward reference is not possible in SQL, so this trigger is
-- created now but the function body above only compiles once 0011 has run. Since migrations
-- apply strictly in order within one `supabase db reset`/`db push`, and CREATE FUNCTION body
-- text is not validated against other objects until first EXECUTE (language plpgsql bodies are
-- opaque strings at CREATE time), this is safe: by the time anyone calls guard_org_member_write
-- for real, 0011 has already run.
drop trigger if exists guard_org_member_write on platform.org_members;
create trigger guard_org_member_write
  before update or delete on platform.org_members
  for each row execute function platform.guard_org_member_write();

-- ── write policies 0001 never added ──────────────────────────────────────────

alter table platform.orgs enable row level security;
alter table platform.org_members enable row level security;

create policy orgs_admin_update on platform.orgs for update to authenticated
  using (id in (select platform.my_org_ids()) and platform.is_org_admin(id))
  with check (id in (select platform.my_org_ids()) and platform.is_org_admin(id));

create policy org_members_admin_write on platform.org_members for insert to authenticated
  with check (platform.is_org_admin(org_id));

create policy org_members_admin_update on platform.org_members for update to authenticated
  using (platform.is_org_admin(org_id))
  with check (platform.is_org_admin(org_id));

create policy org_members_admin_delete on platform.org_members for delete to authenticated
  using (platform.is_org_admin(org_id));

-- RLS is checked *after* GRANTs (see 0001's own note) — both are required. Column-level
-- privilege on orgs restricts an admin to renaming/re-flagging the country, not touching
-- id/slug/created_at — Postgres enforces this natively, no extra trigger needed.
grant update (name, country) on platform.orgs to authenticated;
grant insert, update, delete on platform.org_members to authenticated;
