import { createClient } from "@supabase/supabase-js";
import { getCallingUserId } from "./auth.ts";
import { createSupabaseAdmin } from "./supabaseAdmin.ts";

/**
 * The actual security gate for a module's edge functions — the hub greying out a card is
 * UX only. Resolves the caller's user id from their JWT, then checks platform.has_module()
 * with a service-role client (RLS on platform.* would otherwise require the caller to be a
 * member of an org just to run the check).
 *
 * Returns a discriminated union, not a nullable user id — check for `"response"` and return
 * it immediately on failure, otherwise use `.userId`:
 *
 *   const gate = await requireModule(req, "m5", CORS_HEADERS);
 *   if ("response" in gate) return gate.response;
 *   const { userId } = gate;
 */
export async function requireModule(
  req: Request,
  moduleId: string,
  corsHeaders: Record<string, string>,
): Promise<{ userId: string } | { response: Response }> {
  const userId = await getCallingUserId(req);
  if (!userId) {
    return {
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .schema("platform")
    .rpc("has_module", { p_user: userId, p_module: moduleId });

  if (error) {
    return {
      response: new Response(JSON.stringify({ error: "Entitlement check failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }

  if (!data) {
    return {
      response: new Response(JSON.stringify({ error: `Not entitled to module ${moduleId}` }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }

  return { userId };
}

/**
 * Same shape as requireModule(), for org-invite: the caller must be an owner/admin of the
 * SPECIFIC org they're trying to invite someone into (or platform staff, who can act on any
 * org). Calls platform.is_org_admin()/is_platform_admin() through a client scoped to the
 * CALLER's own JWT (not the service role) so those SECURITY DEFINER functions resolve
 * auth.uid() to the actual caller — both are already GRANTed EXECUTE to `authenticated`
 * (0010, 0011), so no service-role client is needed just to run this check.
 */
export async function requireOrgAdmin(
  req: Request,
  orgId: string,
  corsHeaders: Record<string, string>,
): Promise<{ userId: string } | { response: Response }> {
  const userId = await getCallingUserId(req);
  if (!userId) {
    return {
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }

  const asUserClient = createUserScopedClient(req);
  const [{ data: isOrgAdmin, error: orgAdminError }, { data: isStaff, error: staffError }] =
    await Promise.all([
      asUserClient.schema("platform").rpc("is_org_admin", { p_org: orgId }),
      asUserClient.schema("platform").rpc("is_platform_admin"),
    ]);

  if (orgAdminError || staffError) {
    return {
      response: new Response(JSON.stringify({ error: "Authorization check failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }

  if (!isOrgAdmin && !isStaff) {
    return {
      response: new Response(JSON.stringify({ error: `Not authorized for org ${orgId}` }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }

  return { userId };
}

/** Platform-staff-only gate — used by admin-api. Every action inside it also re-validates
 * with the service-role client before writing, but this stops an unauthenticated or
 * non-staff request before it can even reach the dispatch switch. */
export async function requirePlatformAdmin(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<{ userId: string } | { response: Response }> {
  const userId = await getCallingUserId(req);
  if (!userId) {
    return {
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }

  const asUserClient = createUserScopedClient(req);
  const { data: isStaff, error } = await asUserClient.schema("platform").rpc("is_platform_admin");
  if (error) {
    return {
      response: new Response(JSON.stringify({ error: "Authorization check failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }
  if (!isStaff) {
    return {
      response: new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }
  return { userId };
}

/** A Supabase client authenticated as the CALLER (their own bearer JWT, anon key) rather
 * than the service role — used so is_org_admin()/is_platform_admin() resolve auth.uid() to
 * the actual caller, not nothing. */
function createUserScopedClient(req: Request) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";
  return createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
}
