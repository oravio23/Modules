import { Outlet } from "react-router-dom";
import { AppBackdrop } from "@/components/oravio/AppBackdrop";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";

/**
 * The dark "operations portal" chrome for everything behind ProtectedRoute — Landing and
 * sign-in stay on the light tokens (see AuroraBackdrop), matching oravio.co; once signed
 * in, the platform switches to this navy surface.
 */
export function ShellLayout() {
  return (
    <AppBackdrop className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <SiteFooter />
    </AppBackdrop>
  );
}
