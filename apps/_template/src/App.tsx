import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { RequireModule } from "@/lib/entitlements/RequireModule";
import HomePage from "@/pages/Home";

// "m<N>" here MUST match this module's row id in platform.modules and the "/m<N>/" base in
// vite.config.ts — set all three together when you copy this template (see CONTRIBUTING.md).
const MODULE_ID = "m<N>";

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
          <BrowserRouter basename="/m<N>">
            <Routes>
              <Route element={<ProtectedRoute />}>
                <Route
                  index
                  element={
                    <RequireModule id={MODULE_ID}>
                      <HomePage />
                    </RequireModule>
                  }
                />
              </Route>
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
