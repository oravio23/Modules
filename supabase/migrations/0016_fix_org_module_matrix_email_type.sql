-- platform.org_module_matrix() has never returned a single row.
--
-- Its RETURNS TABLE declares `email text`, but auth.users.email is
-- `character varying(255)`. PL/pgSQL checks the declared row type against the actual query
-- output at RETURN QUERY time and refuses the mismatch outright:
--
--   42804: structure of query does not match function result type
--   Returned type character varying(255) does not match expected type text in column 2.
--
-- So every caller got a 400 instead of data. That is both consumers of the per-user module
-- grid — the staff console's "Team & per-user modules" table
-- (apps/shell/src/pages/admin/AdminOrgDetail.tsx) and the customer-facing
-- "Members & module access" table (apps/shell/src/pages/Org.tsx). Both rendered their
-- headers and then nothing, because react-query swallowed the error into an empty list.
--
-- The 0012-era pgTAP suite missed it because those tests exercise the entitlement LOGIC
-- directly (platform.has_module, the RLS policies, the guard triggers) and never call the
-- read RPCs the UI actually depends on. 08_admin_rpcs.sql now covers that surface.
--
-- Explicit ::text cast rather than widening the declaration to varchar: `text` is the right
-- contract for callers, and this keeps the signature stable for anything already typed
-- against it (apps/shell/src/lib/admin/adminApi.ts, Org.tsx's MatrixRow).

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
    select m.user_id, u.email::text, m.role, mod.id as module_id,
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

grant execute on function platform.org_module_matrix(uuid) to authenticated;
