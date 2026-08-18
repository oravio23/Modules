-- Org invites, and a provisioning rewrite so an invited user doesn't get a junk personal org.
--
-- WHY THIS EXISTS
-- 0008's handle_new_user() fires unconditionally on every auth.users INSERT and gives the new
-- user their own personal org as 'owner'. That was fine when the only way to get an account
-- was self-serve signup. Two things break it now:
--   1. An org admin invites someone to their existing org — the invitee should join THAT org
--      with the invited role, not also get a throwaway personal org nobody uses.
--   2. Email+password signup (0012's sibling work, packages/auth) means an auth.users row can
--      exist with an UNCONFIRMED email. Provisioning an org for an address nobody has proven
--      they own is how a stranger could claim ceo@customer.com's spot before the real person
--      signs up. Provisioning must wait for confirmation.
--
-- This migration replaces the single unconditional trigger with one idempotent function,
-- platform.provision_user(), called from two triggers so it fires exactly once, at the right
-- time, regardless of which path created the confirmed user:
--   - AFTER INSERT on auth.users, but only when the row already arrives confirmed — true for
--     magic-link signups and for invite-accept signups (Supabase confirms both at creation).
--   - AFTER UPDATE on auth.users, only on the transition from unconfirmed to confirmed — true
--     for password signups, which confirm asynchronously via the emailed link.
-- provision_user() itself: redeem every pending, unexpired invite for that email first: each
-- makes the user a member (with the invited role and starting module grants) of an EXISTING
-- org. Only if the user still belongs to no org at all does it fall back to 0008's original
-- behaviour and create a personal org. An invited user therefore never gets a spare org.

create table platform.org_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references platform.orgs(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'member', 'viewer')),
  -- Applied via platform.set_user_modules on redemption. Not validated against
  -- org_has_module() at invite-creation time (the org's entitlement could change before the
  -- invite is redeemed) — set_user_modules already silently drops anything not entitled at
  -- redemption time, so this column is just "what to try to grant", not a promise.
  module_ids text[] not null default '{}',
  invited_by uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null
);

-- Owners cannot be invited — invites only ever create admin/member/viewer memberships. An
-- org always keeps exactly the owner(s) it started with or a role is explicitly promoted
-- later by an existing admin (through the ordinary org_members_admin_update policy from
-- 0010), never by accepting an emailed link.

-- No citext extension is enabled, so normalize by trigger rather than relying on a
-- case-insensitive column type — this is what makes Sara@x.com and sara@x.com the same
-- invite (and the same redemption match against auth.users.email, which Supabase itself
-- lower-cases at signup).
create or replace function platform.normalize_org_invite_email()
returns trigger
language plpgsql
as $$
begin
  new.email := lower(trim(new.email));
  return new;
end;
$$;

drop trigger if exists org_invites_normalize_email on platform.org_invites;
create trigger org_invites_normalize_email
  before insert or update on platform.org_invites
  for each row execute function platform.normalize_org_invite_email();

-- At most one PENDING invite per (org, email) — inviting the same address twice while an
-- invite is outstanding should re-use or revoke-then-recreate it, not silently fork into two
-- redeemable invites with different roles/modules. Accepted/revoked/expired rows are exempt,
-- so re-inviting someone after their first invite expired is unblocked.
create unique index org_invites_one_pending on platform.org_invites (org_id, email)
  where status = 'pending';

alter table platform.org_invites enable row level security;

create policy org_invites_admin_all on platform.org_invites for all to authenticated
  using (platform.is_org_admin(org_id) or platform.is_platform_admin())
  with check (platform.is_org_admin(org_id) or platform.is_platform_admin());

-- An invitee (not yet a member of the org, possibly not org-admin anywhere) still needs to
-- see their own pending invites in a "you've been invited" banner before they've joined.
-- Matched against auth.jwt()'s email claim, not auth.users (RLS can't join auth.users from a
-- policy body without becoming its own can of worms) — the claim is normalized the same way
-- Supabase stores it: lower-cased at signup.
create policy org_invites_invitee_read on platform.org_invites for select to authenticated
  using (email = lower(coalesce(auth.jwt() ->> 'email', '')));

grant select, insert, update, delete on platform.org_invites to authenticated;

-- ── provisioning ──────────────────────────────────────────────────────────────

create or replace function platform.provision_user(p_user uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = platform, public
as $$
declare
  v_email text := lower(trim(p_email));
  v_invite record;
  v_org_id uuid;
  v_org_name text;
begin
  -- Idempotency guard: both triggers below are written to fire at most once per relevant
  -- transition, but a re-run (e.g. a manual UPDATE during support work) should be a no-op,
  -- not a second personal org.
  if exists (select 1 from platform.org_members where user_id = p_user) then
    return;
  end if;

  for v_invite in
    select * from platform.org_invites
     where email = v_email and status = 'pending' and expires_at > now()
     order by created_at
  loop
    insert into platform.org_members (org_id, user_id, role)
    values (v_invite.org_id, p_user, v_invite.role)
    on conflict (org_id, user_id) do nothing;

    if array_length(v_invite.module_ids, 1) is not null then
      -- _unchecked, not the public RPC: there is no acting JWT in this trigger context
      -- (auth.uid() is null), so the public set_user_modules()'s own is_org_admin() /
      -- is_platform_admin() check would always fail here.
      perform platform.set_user_modules_unchecked(
        v_invite.org_id, p_user, v_invite.module_ids, v_invite.invited_by
      );
    end if;

    update platform.org_invites
       set status = 'accepted', accepted_at = now(), accepted_by = p_user
     where id = v_invite.id;
  end loop;

  -- Only fall back to a personal org if no invite gave them one. Re-check membership rather
  -- than trusting "at least one invite existed" — an invite's target org could in principle
  -- have been deleted between being listed above and this point.
  if not exists (select 1 from platform.org_members where user_id = p_user) then
    v_org_name := coalesce(split_part(v_email, '@', 1), 'New') || '''s organization';
    insert into platform.orgs (name, slug)
    values (v_org_name, 'org-' || replace(p_user::text, '-', ''))
    returning id into v_org_id;

    insert into platform.org_members (org_id, user_id, role)
    values (v_org_id, p_user, 'owner');
  end if;
end;
$$;

-- CRITICAL: like set_user_modules_unchecked (0012), PostgreSQL grants EXECUTE on a new
-- function to PUBLIC by default. provision_user(p_user, p_email) takes p_user and p_email
-- as INDEPENDENT arguments with no check that they actually belong to the same account — by
-- design, since the real caller is always a trigger passing NEW.id/NEW.email together. If
-- left PUBLIC-executable, any authenticated user could call
-- provision_user(auth.uid(), 'someone-elses-invited-address@company.com') directly via RPC
-- and redeem an invite that was never sent to them, joining an org they were never invited
-- into. It is only ever meant to run from the two triggers below, which — like every
-- SECURITY DEFINER function calling another one it owns — are unaffected by this revoke.
revoke execute on function platform.provision_user(uuid, text) from public;

create or replace function platform.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = platform, public
as $$
begin
  if new.email_confirmed_at is not null then
    perform platform.provision_user(new.id, new.email);
  end if;
  return new;
end;
$$;

create or replace function platform.handle_user_confirmed()
returns trigger
language plpgsql
security definer
set search_path = platform, public
as $$
begin
  perform platform.provision_user(new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function platform.handle_new_user();

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed
  after update on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function platform.handle_user_confirmed();

-- For someone invited AFTER they already have an account (and are therefore already a
-- member of at least one org — provision_user's personal-org fallback guarantees that): the
-- triggers above never fire again for them, since email_confirmed_at doesn't change. The hub
-- calls this once per load instead, so their next invite gets redeemed without a manual step.
create or replace function platform.redeem_my_invites()
returns void
language plpgsql
security definer
set search_path = platform, public
as $$
declare
  v_invite record;
begin
  for v_invite in
    select * from platform.org_invites
     where email = lower(coalesce((select email from auth.users where id = auth.uid()), ''))
       and status = 'pending' and expires_at > now()
     order by created_at
  loop
    insert into platform.org_members (org_id, user_id, role)
    values (v_invite.org_id, auth.uid(), v_invite.role)
    on conflict (org_id, user_id) do nothing;

    if array_length(v_invite.module_ids, 1) is not null then
      -- _unchecked, not the public RPC: the caller is the INVITEE joining the org, not an
      -- admin OF it, so set_user_modules()'s is_org_admin() check would reject this even
      -- though redeeming one's own invite is exactly what should be allowed here.
      perform platform.set_user_modules_unchecked(
        v_invite.org_id, auth.uid(), v_invite.module_ids, v_invite.invited_by
      );
    end if;

    update platform.org_invites
       set status = 'accepted', accepted_at = now(), accepted_by = auth.uid()
     where id = v_invite.id;
  end loop;
end;
$$;

grant execute on function platform.redeem_my_invites() to authenticated;
