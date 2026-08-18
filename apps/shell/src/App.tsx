import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { RequireStaff } from "@/lib/auth/RequireStaff";
import { ShellLayout } from "@/components/shell/ShellLayout";
import LandingPage from "@/pages/Landing";
import AuthCallbackPage from "@/pages/AuthCallbackPage";
import ResetPasswordPage from "@/pages/ResetPassword";
import HubPage from "@/pages/Hub";
import AccountPage from "@/pages/Account";
import OrgPage from "@/pages/Org";
import AdminOrgsPage from "@/pages/admin/AdminOrgs";
import AdminOrgDetailPage from "@/pages/admin/AdminOrgDetail";
import AdminUsersPage from "@/pages/admin/AdminUsers";
import NoAccessPage from "@/pages/NoAccess";
import NotFoundPage from "@/pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider delayDuration={200}>
          <Toaster richColors closeButton position="top-right" />
          <BrowserRouter>
            <Routes>
              <Route index element={<LandingPage />} />
              <Route path="auth/callback" element={<AuthCallbackPage />} />
              <Route path="auth/reset-password" element={<ResetPasswordPage />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<ShellLayout />}>
                  <Route path="hub" element={<HubPage />} />
                  <Route path="account" element={<AccountPage />} />
                  <Route path="org" element={<OrgPage />} />
                  {/* RequireStaff wraps an <Outlet/> rather than gating each admin route
                      individually — one client-side check for the whole /admin subtree.
                      This is UX only, same as ProtectedRoute/RequireModule: the real
                      boundary is requirePlatformAdmin() inside admin-api and
                      platform.is_platform_admin() in RLS. */}
                  <Route path="admin" element={<RequireStaff><Outlet /></RequireStaff>}>
                    <Route index element={<AdminOrgsPage />} />
                    <Route path="orgs/:orgId" element={<AdminOrgDetailPage />} />
                    <Route path="users" element={<AdminUsersPage />} />
                  </Route>
                  <Route path="no-access/:moduleId" element={<NoAccessPage />} />
                  {/* Unmatched paths still pass through ProtectedRoute first — an
                      unauthenticated visitor to a bad URL gets sent to sign in, not a bare
                      404; a signed-in one gets a real page with header/footer instead of the
                      blank document a missing catch-all used to leave them on. */}
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Route>
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
