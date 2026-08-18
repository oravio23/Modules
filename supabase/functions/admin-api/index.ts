// The Oravio staff console's ONLY write path.
//
// WHY THIS EXISTS
// platform.platform_admins (0011) lets staff READ every org through ordinary RLS. Staff
// WRITES — changing a plan, granting an override, moving someone between orgs — deliberately
// do NOT get a blanket RLS policy: that would let the anon-key browser client rewrite any
// org's billing state directly, with no audit trail and nothing standing between a bug and
// every customer's subscription. Every action here re-validates platform.is_platform_admin()
// for the caller BEFORE doing anything (both at the top of the request, via
// requirePlatformAdmin(), and implicitly by using the service-role client only after that
// gate passes), and appends a platform.admin_audit row either way.
//
// Deliberately no `grant_staff` action: becoming staff has exactly one path, a by-hand
// service-role INSERT into platform.platform_admins from the SQL editor (0011's own header
// comment) — nothing served by this function, or any other, can create a new platform admin.
import { createSupabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { CORS_HEADERS } from "../_shared/auth.ts";
import { requirePlatformAdmin } from "../_shared/entitlements.ts";

type Action =
  | { action: "list_orgs" }
  | { action: "create_org"; name: string; slug: string; country?: string }
  | { action: "set_org_plan"; orgId: string; planId: string; status: string; seats?: number; currentPeriodEnd?: string | null }
  | { action: "set_org_override"; orgId: string; moduleId: string; granted: boolean | null; note?: string }
  | { action: "add_member"; orgId: string; userId?: string; email?: string; role: "owner" | "admin" | "member" | "viewer" }
  | { action: "set_member_role"; orgId: string; userId: string; role: "owner" | "admin" | "member" | "viewer" }
  | { action: "remove_member"; orgId: string; userId: string }
  | { action: "set_user_modules"; orgId: string; userId: string; moduleIds: string[] }
  | { action: "list_users"; page?: number; perPage?: number };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const gate = await requirePlatformAdmin(req, CORS_HEADERS);
  if ("response" in gate) return gate.response;
  const { userId: actorId } = gate;

  let body: Action;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const admin = createSupabaseAdmin();

  async function audit(action: string, targetOrg: string | null, targetUser: string | null, payload: unknown) {
    const { error } = await admin.schema("platform").from("admin_audit").insert({
      actor_id: actorId,
      action,
      target_org: targetOrg,
      target_user: targetUser,
      payload: payload ?? {},
    });
    if (error) console.error("admin_audit insert failed", error);
  }

  try {
    switch (body.action) {
      case "list_orgs":
        return json(await listOrgs(admin));

      case "create_org": {
        if (!body.name || !body.slug) return json({ error: "name and slug are required" }, 400);
        const { data, error } = await admin
          .schema("platform")
          .from("orgs")
          .insert({ name: body.name, slug: body.slug, country: body.country ?? null })
          .select("id, name, slug, country, created_at")
          .single();
        if (error) return json({ error: "Failed to create org", reason: error.message }, 500);
        await audit("create_org", data.id, null, { name: body.name, slug: body.slug });
        return json({ org: data });
      }

      case "set_org_plan": {
        if (!body.orgId || !body.planId || !body.status) {
          return json({ error: "orgId, planId, and status are required" }, 400);
        }
        const { data, error } = await admin
          .schema("platform")
          .from("org_subscriptions")
          .upsert(
            {
              org_id: body.orgId,
              plan_id: body.planId,
              status: body.status,
              seats: body.seats ?? 5,
              current_period_end: body.currentPeriodEnd ?? null,
            },
            { onConflict: "org_id" },
          )
          .select("org_id, plan_id, status, seats, current_period_end")
          .single();
        if (error) return json({ error: "Failed to set plan", reason: error.message }, 500);
        await audit("set_org_plan", body.orgId, null, { planId: body.planId, status: body.status });
        return json({ subscription: data });
      }

      case "set_org_override": {
        if (!body.orgId || !body.moduleId) return json({ error: "orgId and moduleId are required" }, 400);
        if (body.granted === null) {
          // "Inherit": revert to whatever the plan says, by removing the override entirely.
          const { error } = await admin
            .schema("platform")
            .from("org_module_overrides")
            .delete()
            .eq("org_id", body.orgId)
            .eq("module_id", body.moduleId);
          if (error) return json({ error: "Failed to clear override", reason: error.message }, 500);
          await audit("clear_org_override", body.orgId, null, { moduleId: body.moduleId });
          return json({ ok: true, override: null });
        }
        const { data, error } = await admin
          .schema("platform")
          .from("org_module_overrides")
          .upsert(
            { org_id: body.orgId, module_id: body.moduleId, granted: body.granted, note: body.note ?? null },
            { onConflict: "org_id,module_id" },
          )
          .select("org_id, module_id, granted, note")
          .single();
        if (error) return json({ error: "Failed to set override", reason: error.message }, 500);
        await audit("set_org_override", body.orgId, null, { moduleId: body.moduleId, granted: body.granted });
        return json({ override: data });
      }

      case "add_member": {
        if (!body.orgId || !body.role) return json({ error: "orgId and role are required" }, 400);
        let targetUserId = body.userId ?? null;
        if (!targetUserId) {
          if (!body.email) return json({ error: "userId or email is required" }, 400);
          targetUserId = await findUserIdByEmail(admin, body.email);
          if (!targetUserId) {
            return json(
              { error: "No account exists for that email yet. Use org-invite to send them an invite instead." },
              404,
            );
          }
        }
        const { data, error } = await admin
          .schema("platform")
          .from("org_members")
          .insert({ org_id: body.orgId, user_id: targetUserId, role: body.role })
          .select("org_id, user_id, role")
          .single();
        if (error) return json({ error: "Failed to add member", reason: error.message }, 500);
        await audit("add_member", body.orgId, targetUserId, { role: body.role });
        return json({ member: data });
      }

      case "set_member_role": {
        if (!body.orgId || !body.userId || !body.role) {
          return json({ error: "orgId, userId, and role are required" }, 400);
        }
        const { data, error } = await admin
          .schema("platform")
          .from("org_members")
          .update({ role: body.role })
          .eq("org_id", body.orgId)
          .eq("user_id", body.userId)
          .select("org_id, user_id, role")
          .single();
        if (error) {
          // guard_org_member_write (0010) raises a plain exception (not a Postgres
          // constraint code) for "must keep at least one owner" — surface it as a 409
          // rather than a generic 500, since it's a legitimate, expected rejection.
          const isGuardRejection = /at least one owner/i.test(error.message);
          return json({ error: error.message }, isGuardRejection ? 409 : 500);
        }
        await audit("set_member_role", body.orgId, body.userId, { role: body.role });
        return json({ member: data });
      }

      case "remove_member": {
        if (!body.orgId || !body.userId) return json({ error: "orgId and userId are required" }, 400);
        const { error } = await admin
          .schema("platform")
          .from("org_members")
          .delete()
          .eq("org_id", body.orgId)
          .eq("user_id", body.userId);
        if (error) {
          const isGuardRejection = /at least one owner/i.test(error.message);
          return json({ error: error.message }, isGuardRejection ? 409 : 500);
        }
        await audit("remove_member", body.orgId, body.userId, {});
        return json({ ok: true });
      }

      case "set_user_modules": {
        if (!body.orgId || !body.userId || !Array.isArray(body.moduleIds)) {
          return json({ error: "orgId, userId, and moduleIds are required" }, 400);
        }
        // _unchecked, not the public RPC: this request is authenticated as the STAFF
        // member (already verified by requirePlatformAdmin above), not as an admin of
        // body.orgId — platform.set_user_modules()'s own is_org_admin(p_org) check would
        // reject a legitimate staff write for an org they don't belong to.
        const { error } = await admin.schema("platform").rpc("set_user_modules_unchecked", {
          p_org: body.orgId,
          p_user: body.userId,
          p_module_ids: body.moduleIds,
          p_granted_by: actorId,
        });
        if (error) return json({ error: "Failed to set modules", reason: error.message }, 500);
        await audit("set_user_modules", body.orgId, body.userId, { moduleIds: body.moduleIds });
        return json({ ok: true });
      }

      case "list_users": {
        const { data, error } = await admin.auth.admin.listUsers({
          page: body.page ?? 1,
          perPage: body.perPage ?? 200,
        });
        if (error) return json({ error: "Failed to list users", reason: error.message }, 500);
        return json({
          users: data.users.map((u) => ({
            id: u.id,
            email: u.email,
            createdAt: u.created_at,
            lastSignInAt: u.last_sign_in_at,
            confirmedAt: u.email_confirmed_at,
          })),
        });
      }

      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (err) {
    console.error("admin-api: unhandled exception", err instanceof Error ? err.stack ?? err.message : String(err));
    return json({ error: "Internal error", reason: err instanceof Error ? err.message : String(err) }, 500);
  }
});

// deno-lint-ignore no-explicit-any
async function listOrgs(admin: any) {
  const [{ data: orgs, error: orgsError }, { data: subs, error: subsError }, { data: members, error: membersError }] =
    await Promise.all([
      admin.schema("platform").from("orgs").select("id, name, slug, country, created_at").order("created_at"),
      admin.schema("platform").from("org_subscriptions").select("org_id, plan_id, status, seats, current_period_end"),
      admin.schema("platform").from("org_members").select("org_id"),
    ]);
  if (orgsError || subsError || membersError) {
    throw new Error(orgsError?.message ?? subsError?.message ?? membersError?.message ?? "Failed to list orgs");
  }

  const subsByOrg = new Map(subs.map((s: { org_id: string }) => [s.org_id, s]));
  const memberCounts = new Map<string, number>();
  for (const m of members as { org_id: string }[]) {
    memberCounts.set(m.org_id, (memberCounts.get(m.org_id) ?? 0) + 1);
  }

  return {
    orgs: orgs.map((org: { id: string }) => ({
      ...org,
      subscription: subsByOrg.get(org.id) ?? null,
      memberCount: memberCounts.get(org.id) ?? 0,
    })),
  };
}

/**
 * There is no direct "get user by email" in the supabase-js admin API (only listUsers()
 * pagination and getUserById()), so this walks pages looking for an exact, case-insensitive
 * match. Fine at pilot scale; would need a real index-backed lookup (or Supabase adding one)
 * well before this becomes a bottleneck — noted here rather than silently accepted forever.
 */
// deno-lint-ignore no-explicit-any
async function findUserIdByEmail(admin: any, email: string): Promise<string | null> {
  const target = email.trim().toLowerCase();
  const perPage = 200;
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    const match = data.users.find((u: { email?: string }) => u.email?.toLowerCase() === target);
    if (match) return match.id;
    if (data.users.length < perPage) return null; // last page
  }
  return null;
}
