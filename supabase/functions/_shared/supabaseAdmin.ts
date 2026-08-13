import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for edge-function-to-database access —
 * bypasses RLS, so it must never be exposed to the browser. `SUPABASE_URL`
 * and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically into every
 * edge function's environment by the platform; nothing to configure.
 */
export function createSupabaseAdmin(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not available in this environment.");
  }
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}
