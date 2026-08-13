import * as React from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  /** True until the first getSession() resolves. Every consumer (ProtectedRoute, the
   * hub header, …) must treat this as "unknown yet", not "signed out" — redirecting on
   * a still-loading state is what causes a login flash on every page refresh. */
  loading: boolean;
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

/**
 * The one thing M5 never had: a single subscribed session, shared by every component,
 * instead of each call site independently calling ensureAnonymousSession(). Every app
 * that syncs this file wraps its router in <AuthProvider> once, at the root.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({ session, user: session?.user ?? null, loading }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function useAuthContext(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useSession/useUser must be used within <AuthProvider>");
  return ctx;
}

export function useSession(): AuthContextValue {
  return useAuthContext();
}

export function useUser(): User | null {
  return useAuthContext().user;
}
