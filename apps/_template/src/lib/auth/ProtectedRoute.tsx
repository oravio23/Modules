import { Outlet } from "react-router-dom";
import { useSession } from "./AuthProvider";

/**
 * Renders nothing while the session is still loading — NOT a redirect. Redirecting during
 * the loading state is what causes a visible flash to the login page on every hard refresh,
 * since getSession() takes a tick to resolve even for an already-signed-in user.
 *
 * Redirects with a full page navigation to an ORIGIN-ABSOLUTE path, not react-router's
 * <Navigate>. This component is vendored into every app, and every module app other than
 * the shell mounts its router with basename="/m<N>" — a relative <Navigate to="/..."> would
 * resolve to "/m<N>/..." and 404, since the login page only exists at the shell's root.
 * A full navigation is also the correct way to cross from one app's bundle to another's
 * under the path-rewrite deploy model (see Phase 6 of the design plan) — they're separate
 * SPA builds sharing one origin, not client-side routes within the same bundle.
 */
export function ProtectedRoute() {
  const { session, loading } = useSession();

  if (loading) return null;

  if (!session) {
    // If the current URL already carries a `next` (e.g. this component re-fires on the
    // redirect target itself — which happens in local dev, where each module runs on its
    // own port with no shell to land on, so "/" resolves back to this same app), reuse that
    // original value instead of re-encoding the whole current URL, which already contains
    // it. Without this, each re-fire nests another layer of percent-encoding around the
    // previous one, growing the URL exponentially every redirect.
    const existingNext = new URLSearchParams(window.location.search).get("next");
    const next = existingNext ?? window.location.pathname + window.location.search;
    window.location.assign(`/?next=${encodeURIComponent(next)}`);
    return null;
  }

  return <Outlet />;
}
