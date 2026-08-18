/**
 * pipeline-worker's actual auth gate.
 *
 * WHY THIS EXISTS
 * pipeline-worker has `verify_jwt = false` in supabase/config.toml — necessary because it's
 * invoked by documents-register and by self-reinvocation, both carrying the service-role key
 * as a bearer token, never a user session. But `verify_jwt = false` only skips the platform
 * gateway's JWT check; nothing inside the function itself ever verified that bearer token.
 * The result: anyone who discovered (or guessed) a job UUID could POST
 * `{jobId}` straight to the function's public URL and have it run — spending Anthropic
 * tokens on Oravio's account for a job that isn't theirs, with no entitlement check at all
 * (there's no user in this request to check platform.has_module() against in the first
 * place). See docs/hub-v1-contract-audit.md §6 gap 1.
 *
 * Deliberately a SEPARATE secret from SUPABASE_SERVICE_ROLE_KEY, not a comparison against
 * that key directly: the service-role key already flows through this same header for
 * PostgREST/Storage calls made by createSupabaseAdmin() elsewhere, so comparing against it
 * here would mean any code path that already needs the service-role key ALSO doubles as a
 * pipeline-worker credential. A leak of PIPELINE_WORKER_SECRET only lets someone invoke this
 * one function; a leak of the service-role key would be catastrophic either way, and this
 * split keeps that blast radius from growing.
 *
 * Set with `supabase secrets set PIPELINE_WORKER_SECRET=<random-value>` — see
 * docs/deploy-checklist.md. Locally, .env.example documents a fixed dev value so
 * `supabase start` works without an extra manual step.
 */

const HEADER_NAME = "x-pipeline-secret";

/** Equal-length, constant-time-ish comparison — avoids a naive `===` timing side-channel on
 * the secret's value. (Length itself is not treated as secret, matching Node's own
 * crypto.timingSafeEqual, which also requires equal-length inputs.) */
function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

export function pipelineAuthHeaders(): Record<string, string> {
  const secret = Deno.env.get("PIPELINE_WORKER_SECRET");
  if (!secret) throw new Error("PIPELINE_WORKER_SECRET is not set.");
  return { [HEADER_NAME]: secret };
}

/** Returns a Response to short-circuit with on failure, or null when the caller is authorized. */
export function requirePipelineSecret(req: Request, corsHeaders: Record<string, string>): Response | null {
  const expected = Deno.env.get("PIPELINE_WORKER_SECRET");
  const provided = req.headers.get(HEADER_NAME);
  if (!expected) {
    console.error("pipeline-worker: PIPELINE_WORKER_SECRET is not configured");
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!provided || !timingSafeEqual(provided, expected)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return null;
}
