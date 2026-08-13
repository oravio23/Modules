import * as React from "react";
import { useHasModule } from "./useEntitlements";

/**
 * Client-side gate for a module's routes. This is UX, not security — the real boundary is
 * platform.has_module() inside each module's RLS policies and requireModule() in its edge
 * functions. A user who guesses the URL for a module they don't have is redirected here,
 * but a user who bypasses the frontend entirely still hits a wall at the database.
 *
 * Redirects with a full page navigation, not react-router's <Navigate>: /no-access/:id is a
 * shell-only route, and this component is vendored into every module app too, each mounted
 * with its own basename="/m<N>" — a relative <Navigate> would resolve under that basename
 * and 404 instead of reaching the shell's page.
 */
export function RequireModule({ id, children }: { id: string; children: React.ReactNode }) {
  const { granted, loading } = useHasModule(id);

  if (loading) return null;

  if (!granted) {
    window.location.assign(`/no-access/${id}`);
    return null;
  }

  return <>{children}</>;
}
