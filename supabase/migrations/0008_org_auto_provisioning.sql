-- Auto-provision an org for every new user on signup.
--
-- WHY THIS EXISTS
-- Nothing before this migration ever created a platform.orgs or platform.org_members row.
-- Signup is enabled (config.toml enable_signup = true), but there was no trigger, RPC, or
-- admin UI that gave a brand-new user a first org — so every signup reached a permanently
-- locked hub (platform.my_modules() returns every module ungranted forever, since
-- has_module() has no org_members row to resolve against) and apps/m5-documents's
-- getCurrentOrgId() threw "You aren't a member of an organization yet". There was no manual
-- step that could fix this either, because nothing wrote a first org for anyone to be added
-- to. See docs/hub-v1-contract-audit.md §9.
--
-- This does NOT grant any plan or module access. A fresh org has no row in
-- platform.org_subscriptions and no platform.org_module_overrides row, so
-- platform.has_module() still returns false for every module — the hub shows a fully
-- locked-but-visible grid, same as any customer whose trial hasn't started. Granting real
-- entitlements stays a deliberate action (an org_subscriptions row once packaging exists,
-- or an org_module_overrides row for a pilot one-off), matching the model 0001 already
-- describes. This migration only removes the "there is nowhere to grant access to" blocker
-- — it is safe to run against production exactly as written.
create or replace function platform.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = platform, public
as $$
declare
  v_org_id uuid;
  v_org_name text;
begin
  v_org_name := coalesce(split_part(new.email, '@', 1), 'New') || '''s organization';

  insert into platform.orgs (name, slug)
  values (v_org_name, 'org-' || replace(new.id::text, '-', ''))
  returning id into v_org_id;

  insert into platform.org_members (org_id, user_id, role)
  values (v_org_id, new.id, 'owner');

  return new;
end;
$$;

-- Re-creatable on repeated `supabase db reset` / re-deploy without erroring.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function platform.handle_new_user();
