import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { RequireModule } from "@/lib/entitlements/RequireModule";
import { AppShell } from "@/components/layout/AppShell";
import UploadPage from "@/pages/Upload";
import QueuePage from "@/pages/Queue";
import ReviewPage from "@/pages/Review";
import ProfilesPage from "@/pages/Profiles";
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
          <BrowserRouter basename="/m5">
            <Routes>
              <Route element={<ProtectedRoute />}>
                <Route
                  element={
                    <RequireModule id="m5">
                      <AppShell />
                    </RequireModule>
                  }
                >
                  <Route index element={<UploadPage />} />
                  <Route path="queue" element={<QueuePage />} />
                  <Route path="review/:documentId" element={<ReviewPage />} />
                  <Route path="profiles" element={<ProfilesPage />} />
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
