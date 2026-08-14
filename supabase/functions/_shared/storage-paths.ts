/**
 * Server-side guard that a client-supplied Storage key really belongs to the caller's org.
 *
 * WHY THIS EXISTS
 * The browser uploads to Storage under `${orgId}/${uploadId}/...` (see
 * src/lib/upload/uploadDocument.ts) and that write is constrained by the bucket policy
 * `m5_documents_bucket_org_scoped`, which checks `(storage.foldername(name))[1]` against
 * the caller's org membership. But documents-register then reads those same paths back
 * through createSupabaseAdmin() — a service_role client, which has BYPASSRLS and is
 * therefore NOT constrained by that policy. Without this check, an authenticated user
 * entitled to the module could post another org's Storage key and have the server fetch
 * that file, forward it to the Anthropic Files API, and register it as a document in their
 * own org. The path has to be re-validated here because the only thing that validated it
 * the first time was a policy this code path deliberately bypasses.
 *
 * Mirrors the bucket policy's own notion of a folder: segments split on '/', first segment
 * must be the org id. The comparison is case-insensitive because the policy's comparison is
 * a CAST (`::uuid`), not a string match — being stricter here than the policy would 403 an
 * object Storage had already accepted into the caller's own folder.
 *
 * Backslashes are rejected outright rather than normalised: Postgres `storage.foldername()`
 * does not treat them as separators, so accepting them would mean this check and the policy
 * disagree about where the folder boundary is. '.' and '..' segments are rejected for the
 * same reason — Storage keys are opaque strings, so no layer below this one collapses them
 * back to a path inside the org folder.
 *
 * Takes `unknown` deliberately: this is a security gate on a JSON request body, so it must
 * reject anything that isn't a string rather than trusting the declared request type or
 * throwing on hostile input (a throw here would surface as an opaque 500, and any caller
 * that filtered non-strings out first would skip the check entirely).
 */
export function isOrgScopedPath(path: unknown, orgId: string): boolean {
  if (typeof path !== "string" || path === "" || path.includes("\\")) return false;

  const segments = path.split("/");
  if (segments.length < 2) return false; // the org folder alone is not an object key
  if (segments[0].toLowerCase() !== orgId.toLowerCase()) return false;

  return segments.slice(1).every((segment) => segment !== "" && segment !== "." && segment !== "..");
}
