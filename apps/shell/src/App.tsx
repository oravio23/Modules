import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { ShellLayout } from "@/components/shell/ShellLayout";
import LandingPage from "@/pages/Landing";
import AuthCallbackPage from "@/pages/AuthCallbackPage";
import HubPage from "@/pages/Hub";
import AccountPage from "@/pages/Account";
import OrgPage from "@/pages/Org";
import NoAccessPage from "@/pages/NoAccess";

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
              <Route element={<ProtectedRoute />}>
                <Route element={<ShellLayout />}>
                  <Route path="hub" element={<HubPage />} />
                  <Route path="account" element={<AccountPage />} />
                  <Route path="org" element={<OrgPage />} />
                  <Route path="no-access/:moduleId" element={<NoAccessPage />} />
                </Route>
              </Route>
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
