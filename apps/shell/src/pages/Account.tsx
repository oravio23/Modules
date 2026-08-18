import * as React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/lib/auth/AuthProvider";
import { signOut } from "@/lib/auth/signOut";
import { supabase } from "@/integrations/supabase/client";
import { fadeUp, useMotionSafe } from "@/components/oravio/motion";

export default function AccountPage() {
  const user = useUser();
  const navigate = useNavigate();
  const motionSafe = useMotionSafe();
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  async function handleSignOut() {
    await signOut();
    navigate("/", { replace: true });
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
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
    setPassword("");
    setConfirm("");
    setSaved(true);
  }

  return (
    <div className="mx-auto max-w-2xl px-[clamp(18px,4vw,56px)] py-12">
      <h1 className="text-2xl font-semibold text-[var(--app-text)]">Account</h1>
      <motion.div
        initial={motionSafe ? "hidden" : "visible"}
        animate="visible"
        variants={fadeUp}
        className="space-y-6"
      >
        <Card className="mt-6 border-[var(--app-line)] bg-[var(--app-surface)] text-[var(--app-text)]">
          <CardHeader>
            <CardTitle className="text-[var(--app-text)]">Signed in as</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-[var(--app-text-muted)]">{user?.email}</p>
            <Button variant="outline" onClick={handleSignOut}>
              Sign out
            </Button>
          </CardContent>
        </Card>

        <Card className="border-[var(--app-line)] bg-[var(--app-surface)] text-[var(--app-text)]">
          <CardHeader>
            <CardTitle className="text-[var(--app-text)]">Password</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Doubles as "set a password" for an account that has only ever signed in via
                magic link — supabase.auth.updateUser() works the same either way. */}
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="account-new-password">New password</Label>
                <Input
                  id="account-new-password"
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
                <Label htmlFor="account-confirm-password">Confirm password</Label>
                <Input
                  id="account-confirm-password"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirm(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : "Update password"}
              </Button>
              {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
              {saved && <p className="text-sm text-[var(--app-text-muted)]">Password updated.</p>}
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
