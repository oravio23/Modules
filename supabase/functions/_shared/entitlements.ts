import { getCallingUserId } from "./auth.ts";
import { createSupabaseAdmin } from "./supabaseAdmin.ts";

/**
 * The actual security gate for a module's edge functions — the hub greying out a card is
 * UX only. Resolves the caller's user id from their JWT, then checks platform.has_module()
 * with a service-role client (RLS on platform.* would otherwise require the caller to be a
 * member of an org just to run the check). Returns the user id on success; writes a 401/403
 * response and returns null on failure, so call sites can `if (!userId) return res;`.
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
