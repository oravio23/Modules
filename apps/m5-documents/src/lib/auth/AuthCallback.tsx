import * as React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthPending } from "@/components/oravio/AuthPending";
import { useSession } from "./AuthProvider";

const TIMEOUT_MS = 8000;

/**
 * Route target for both the magic-link and OAuth redirect. supabase-js's client is
 * constructed with detectSessionInUrl: true (the v2 default), so it already exchanged
 * the URL's code/token for a session by the time this mounts — this component only has
 * to wait for that session to land in <AuthProvider>'s state, then redirect to `next`
 * (or /hub). If nothing arrives within TIMEOUT_MS, the link was invalid or expired.
 */
export function AuthCallback() {
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [timedOut, setTimedOut] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  React.useEffect(() => {
    if (loading || !session) return;
    const next = params.get("next");
    navigate(next && next.startsWith("/") ? next : "/hub", { replace: true });
  }, [session, loading, navigate, params]);

  if (timedOut && !session) {
    return (
      <div className="flex min-h-svh items-center justify-center px-6 text-center">
        <div className="max-w-sm space-y-2">
          <p className="text-sm font-medium text-foreground">That sign-in link didn't work.</p>
          <p className="text-sm text-muted-foreground">
            It may have expired or already been used. Head back and request a new one.
          </p>
        </div>
      </div>
    );
  }

  return <AuthPending />;
}
