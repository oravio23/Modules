import { createClient } from "@supabase/supabase-js";

/** Resolve the calling browser session's user id from its bearer JWT, without a service-role client. Returns null if unauthenticated. */
export async function getCallingUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const asUser = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data, error } = await asUser.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
