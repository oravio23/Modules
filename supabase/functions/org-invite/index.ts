// Org admins inviting a teammate into their EXISTING org — the counterpart to
// platform.org_invites (0013_org_invites_and_provisioning.sql). Two actions:
//   create — insert the invite row, then try to send it via Supabase's built-in mailer.
//   revoke — cancel a still-pending invite.
//
// Why this needs an edge function rather than being pure RLS + a client-side insert: sending
// the actual invite email requires supabase.auth.admin.inviteUserByEmail(), which only works
// with the service-role key (never safe in the browser). The invite ROW itself could be
// inserted directly by the browser under org_invites' RLS policy (0013), but creating it here
// too keeps "insert the row" and "send the email" atomic from the caller's point of view and
// keeps the ordering guarantee provision_user() depends on: the invite row must exist BEFORE
// inviteUserByEmail() creates the auth.users row, or the new user's on_auth_user_created
// trigger runs before there's anything to redeem and they fall through to the personal-org
// fallback instead of joining this org.
import { createSupabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { CORS_HEADERS } from "../_shared/auth.ts";
import { requireOrgAdmin } from "../_shared/entitlements.ts";

interface CreateInviteRequest {
  action: "create";
  orgId: string;
  email: string;
  role: "admin" | "member" | "viewer";
  moduleIds?: string[];
}

interface RevokeInviteRequest {
  action: "revoke";
  inviteId: string;
}

type OrgInviteRequest = CreateInviteRequest | RevokeInviteRequest;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    return await handle(req);
  } catch (err) {
    console.error("org-invite: unhandled exception", err instanceof Error ? err.stack ?? err.message : String(err));
    return json({ error: "Internal error", reason: err instanceof Error ? err.message : String(err) }, 500);
  }
});

async function handle(req: Request): Promise<Response> {
  let body: OrgInviteRequest;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (body.action === "create") return handleCreate(req, body);
  if (body.action === "revoke") return handleRevoke(req, body);
  return json({ error: "Unknown action" }, 400);
}

async function handleCreate(req: Request, body: CreateInviteRequest): Promise<Response> {
  if (!body.orgId || !body.email || !body.role) {
    return json({ error: "Missing required fields (orgId, email, role)" }, 400);
  }
  if (!["admin", "member", "viewer"].includes(body.role)) {
    return json({ error: "role must be admin, member, or viewer" }, 400);
  }

  const gate = await requireOrgAdmin(req, body.orgId, CORS_HEADERS);
  if ("response" in gate) return gate.response;
  const { userId } = gate;

  const admin = createSupabaseAdmin();
  const email = body.email.trim().toLowerCase();

  const { data: invite, error: insertError } = await admin
    .schema("platform")
    .from("org_invites")
    .insert({
      org_id: body.orgId,
      email,
      role: body.role,
      module_ids: body.moduleIds ?? [],
      invited_by: userId,
    })
    .select("id, org_id, email, role, module_ids, status, expires_at")
    .single();

  if (insertError) {
    // 23505 = unique_violation, from org_invites_one_pending (0013): an unexpired pending
    // invite already exists for this (org, email). Surface as a clear 409, not a 500 —
    // the admin console should offer "revoke and re-invite", not a generic failure.
    if (insertError.code === "23505") {
      return json({ error: "An invite is already pending for that email in this org." }, 409);
    }
    console.error("org_invites insert failed", insertError);
    return json({ error: "Failed to create invite", reason: insertError.message }, 500);
  }

  // Best-effort: send the actual email. Known limitation (see docs/hub-v1-contract-audit.md
  // and CONTRIBUTING.md) — Supabase's built-in mailer has no template for "invited to an
  // existing account" and inviteUserByEmail() only sends when NO auth.users row exists yet
  // for that address. If it already does, this is a no-op: the invite row is still valid and
  // redeem_my_invites() picks it up the next time that person loads the hub signed in — the
  // console should tell the admin to let the invitee know directly in that case.
  const redirectTo = `${req.headers.get("origin") ?? Deno.env.get("SUPABASE_URL")}/auth/callback`;
  let emailSent = false;
  let existingAccount = false;
  const { error: inviteEmailError } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
  if (inviteEmailError) {
    const alreadyExists = /already registered|already exists|already been registered/i.test(inviteEmailError.message);
    if (alreadyExists) {
      existingAccount = true;
    } else {
      console.error("inviteUserByEmail failed", inviteEmailError);
    }
  } else {
    emailSent = true;
  }

  return json({ invite, emailSent, existingAccount });
}

async function handleRevoke(req: Request, body: RevokeInviteRequest): Promise<Response> {
  if (!body.inviteId) return json({ error: "Missing required field (inviteId)" }, 400);

  const admin = createSupabaseAdmin();
  const { data: existing, error: fetchError } = await admin
    .schema("platform")
    .from("org_invites")
    .select("id, org_id, status")
    .eq("id", body.inviteId)
    .maybeSingle();

  if (fetchError) return json({ error: "Failed to look up invite", reason: fetchError.message }, 500);
  if (!existing) return json({ error: "Invite not found" }, 404);

  const gate = await requireOrgAdmin(req, existing.org_id as string, CORS_HEADERS);
  if ("response" in gate) return gate.response;

  if (existing.status !== "pending") {
    return json({ error: `Invite is already ${existing.status}, cannot revoke.` }, 409);
  }

  const { error: updateError } = await admin
    .schema("platform")
    .from("org_invites")
    .update({ status: "revoked" })
    .eq("id", body.inviteId);

  if (updateError) return json({ error: "Failed to revoke invite", reason: updateError.message }, 500);

  return json({ ok: true });
}
