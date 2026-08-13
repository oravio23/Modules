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
