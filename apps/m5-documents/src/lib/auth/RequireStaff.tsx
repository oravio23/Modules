import * as React from "react";
import { useIsPlatformAdmin } from "./useIsPlatformAdmin";

/**
 * Client-side gate for the /admin staff console. This is UX, not security — the real
 * boundary is platform.is_platform_admin() inside RLS (staff reads) and the admin-api edge
 * function's own check (staff writes). A non-staff user who guesses /admin's URL is bounced
 * here; every RPC and edge-function call the console makes is authorized independently.
 *
 * Redirects with a full page navigation, matching ProtectedRoute/RequireModule's own
 * reasoning: this file is vendored into every app via sync-ui.mjs, and a relative
 * <Navigate> would resolve under a module app's basename="/m<N>" instead of the shell's root.
 */
export function RequireStaff({ children }: { children: React.ReactNode }) {
  const { isStaff, loading } = useIsPlatformAdmin();

  if (loading) return null;

  if (!isStaff) {
    window.location.assign("/hub");
    return null;
  }

  return <>{children}</>;
}
