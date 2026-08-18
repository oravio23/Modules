import { supabase } from "@/integrations/supabase/client";

// Thin typed wrapper around the admin-api edge function — the staff console's ONLY write
// path (see supabase/functions/admin-api/index.ts for why: staff writes go through a
// service-role function with an audit trail, never a blanket RLS policy). Deliberately
// lives under apps/shell/src/lib/, NOT packages/, so scripts/sync-ui.mjs never vendors
// staff-console code into a module app — see CONTRIBUTING.md's vendoring rule.

export interface AdminOrg {
  id: string;
  name: string;
  slug: string;
  country: string | null;
  created_at: string;
  subscription: { org_id: string; plan_id: string; status: string; seats: number; current_period_end: string | null } | null;
  memberCount: number;
}

export interface AdminUser {
  id: string;
  email: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  confirmedAt: string | null;
}

async function call<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("admin-api", { body: { action, ...payload } });
  if (error) throw error;
  return data as T;
}

export const adminApi = {
  listOrgs: () => call<{ orgs: AdminOrg[] }>("list_orgs"),
  createOrg: (name: string, slug: string, country?: string) => call<{ org: AdminOrg }>("create_org", { name, slug, country }),
  setOrgPlan: (orgId: string, planId: string, status: string, seats?: number) =>
    call<{ subscription: unknown }>("set_org_plan", { orgId, planId, status, seats }),
  setOrgOverride: (orgId: string, moduleId: string, granted: boolean | null, note?: string) =>
    call<{ override: unknown }>("set_org_override", { orgId, moduleId, granted, note }),
  addMember: (orgId: string, role: string, opts: { userId?: string; email?: string }) =>
    call<{ member: unknown }>("add_member", { orgId, role, ...opts }),
  setMemberRole: (orgId: string, userId: string, role: string) =>
    call<{ member: unknown }>("set_member_role", { orgId, userId, role }),
  removeMember: (orgId: string, userId: string) => call<{ ok: true }>("remove_member", { orgId, userId }),
  setUserModules: (orgId: string, userId: string, moduleIds: string[]) =>
    call<{ ok: true }>("set_user_modules", { orgId, userId, moduleIds }),
  listUsers: (page = 1, perPage = 200) => call<{ users: AdminUser[] }>("list_users", { page, perPage }),
};
