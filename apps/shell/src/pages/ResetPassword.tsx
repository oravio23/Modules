import * as React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthPending } from "@/components/oravio/AuthPending";
import { useSession } from "@/lib/auth/AuthProvider";
import { goToNext } from "@/lib/auth/nextTarget";
import { supabase } from "@/integrations/supabase/client";

const TIMEOUT_MS = 8000;

/**
 * Route target for supabase.auth.resetPasswordForEmail's redirectTo. Same mechanics as
 * AuthCallback: supabase-js's detectSessionInUrl already exchanged the emailed link's
 * recovery token for a session by the time this mounts, so this only has to wait for that
 * session to land in AuthProvider, then let the user set a new password with it.
 */
export default function ResetPasswordPage() {
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [timedOut, setTimedOut] = React.useState(false);
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    const { error: authError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    setDone(true);
    const next = params.get("next");
    setTimeout(() => goToNext(next, navigate), 1200);
  }

  if (loading) return null;

  if (!session) {
    if (timedOut) {
      return (
        <div className="flex min-h-svh items-center justify-center px-6 text-center">
          <div className="max-w-sm space-y-2">
            <p className="text-sm font-medium text-foreground">That reset link didn't work.</p>
            <p className="text-sm text-muted-foreground">
              It may have expired or already been used. Request a new one from the sign-in page.
            </p>
          </div>
        </div>
      );
    }
    return <AuthPending />;
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-md items-center px-[clamp(18px,4vw,56px)]">
      <Card className="w-full border-[var(--app-line)] bg-[var(--app-surface)] text-[var(--app-text)]">
        <CardHeader>
          <CardTitle className="text-[var(--app-text)]">Set a new password</CardTitle>
        </CardHeader>
        <CardContent>
          {done ? (
            <p className="text-sm text-[var(--app-text-muted)]">Password updated. Taking you to the hub…</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirm(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Saving…" : "Save password"}
              </Button>
              {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
