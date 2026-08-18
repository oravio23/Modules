import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DUR_BASE, EASE_OUT, useMotionSafe } from "@/components/oravio/motion";
import { supabase } from "@/integrations/supabase/client";

type Mode = "sign-in" | "sign-up";
type Submitting = "idle" | "password" | "magic-link" | "reset" | "google" | "azure";

const fadeSlide = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

function GoogleIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
      <path
        d="M19.6 10.23c0-.68-.06-1.33-.17-1.96H10v3.71h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.23c1.89-1.74 2.99-4.3 2.99-7.27Z"
        fill="#4285F4"
      />
      <path
        d="M10 20c2.7 0 4.96-.89 6.61-2.41l-3.23-2.5c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H1.06v2.59A10 10 0 0 0 10 20Z"
        fill="#34A853"
      />
      <path
        d="M4.41 11.93a5.99 5.99 0 0 1 0-3.86V5.48H1.06a10 10 0 0 0 0 9.04l3.35-2.6Z"
        fill="#FBBC05"
      />
      <path
        d="M10 3.96c1.47 0 2.79.5 3.83 1.49l2.87-2.87A9.6 9.6 0 0 0 10 0 10 10 0 0 0 1.06 5.48l3.35 2.6C5.2 5.72 7.4 3.96 10 3.96Z"
        fill="#EA4335"
      />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
      <rect x="1" y="1" width="8.5" height="8.5" fill="#F25022" />
      <rect x="10.5" y="1" width="8.5" height="8.5" fill="#7FBA00" />
      <rect x="1" y="10.5" width="8.5" height="8.5" fill="#00A4EF" />
      <rect x="10.5" y="10.5" width="8.5" height="8.5" fill="#FFB900" />
    </svg>
  );
}

/**
 * Email+password is the primary flow now (sign in / create account tabs), with a magic-link
 * fallback for anyone who'd rather not set a password, and a forgot-password reset link.
 * OAuth stays in the file — buttons render only when VITE_ENABLE_OAUTH="true" — because
 * neither Google nor Microsoft is configured on any Supabase project yet (both fail with a
 * provider-not-enabled error); shipping a broken button is worse than omitting the feature.
 * See docs/deploy-checklist.md for what registering the providers requires.
 */
export function AuthCard() {
  const [mode, setMode] = React.useState<Mode>("sign-in");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState<Submitting>("idle");
  const [magicLinkOpen, setMagicLinkOpen] = React.useState(false);
  const [sent, setSent] = React.useState<"magic-link" | "sign-up" | "reset" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [params] = useSearchParams();
  const motionSafe = useMotionSafe();
  const oauthEnabled = import.meta.env.VITE_ENABLE_OAUTH === "true";

  // Forward the deep link a signed-out user was bounced from (set by ProtectedRoute) through
  // whichever auth flow they use, so AuthCallback can send them back to it instead of
  // defaulting to /hub. Only accept a same-app relative path, never an absolute/external URL.
  const next = params.get("next");
  const nextSuffix = next && next.startsWith("/") ? `?next=${encodeURIComponent(next)}` : "";
  const redirectTo = `${window.location.origin}/auth/callback${nextSuffix}`;
  const resetRedirectTo = `${window.location.origin}/auth/reset-password${nextSuffix}`;

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email || !password) return;
    setSubmitting("password");

    if (mode === "sign-in") {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      setSubmitting("idle");
      if (authError) setError(authError.message);
      // On success, AuthProvider's onAuthStateChange fires and Landing/ProtectedRoute
      // redirect away from this page — nothing else to do here.
      return;
    }

    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectTo },
    });
    setSubmitting("idle");
    if (authError) {
      setError(authError.message);
      return;
    }
    setSent("sign-up");
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email) return;
    setSubmitting("magic-link");
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    setSubmitting("idle");
    if (authError) {
      setError(authError.message);
      return;
    }
    setSent("magic-link");
  }

  async function handleForgotPassword() {
    setError(null);
    if (!email) {
      setError("Enter your email above first, then choose “Forgot password?”.");
      return;
    }
    setSubmitting("reset");
    const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: resetRedirectTo,
    });
    setSubmitting("idle");
    if (authError) {
      setError(authError.message);
      return;
    }
    setSent("reset");
  }

  async function handleOAuth(provider: "google" | "azure") {
    setError(null);
    setSubmitting(provider);
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (authError) {
      setSubmitting("idle");
      setError(authError.message);
    }
    // On success the browser navigates away to the provider; nothing else to do here.
  }

  const transition = { duration: DUR_BASE, ease: EASE_OUT };
  const busy = submitting !== "idle";

  return (
    <motion.div
      layout={motionSafe}
      className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)] p-8"
    >
      <AnimatePresence mode="wait" initial={false}>
        {sent ? (
          <motion.div
            key="sent"
            initial={motionSafe ? fadeSlide.initial : false}
            animate={fadeSlide.animate}
            exit={motionSafe ? fadeSlide.exit : undefined}
            transition={transition}
            className="text-center"
          >
            <p className="text-sm font-semibold text-[var(--navy)]">Check your email</p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {sent === "sign-up" &&
                <>We sent a confirmation link to <span className="font-medium text-[var(--ink)]">{email}</span>. Click it to activate your account.</>}
              {sent === "magic-link" &&
                <>We sent a sign-in link to <span className="font-medium text-[var(--ink)]">{email}</span>.</>}
              {sent === "reset" &&
                <>We sent a password reset link to <span className="font-medium text-[var(--ink)]">{email}</span>.</>}
            </p>
            <Button variant="link" className="mt-2" onClick={() => setSent(null)}>
              Back
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={motionSafe ? fadeSlide.initial : false}
            animate={fadeSlide.animate}
            exit={motionSafe ? fadeSlide.exit : undefined}
            transition={transition}
          >
            <Tabs value={mode} onValueChange={(v) => { setMode(v as Mode); setError(null); }}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="sign-in">Sign in</TabsTrigger>
                <TabsTrigger value="sign-up">Create account</TabsTrigger>
              </TabsList>

              <TabsContent value={mode} className="mt-4">
                {!magicLinkOpen ? (
                  <form onSubmit={handlePasswordSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Work email</Label>
                      <Input
                        id="email"
                        type="email"
                        required
                        autoComplete="email"
                        placeholder="you@company.com"
                        value={email}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                        className="focus-visible:ring-2 focus-visible:ring-[var(--teal)]"
                        aria-invalid={error ? true : undefined}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password">Password</Label>
                        {mode === "sign-in" && (
                          <button
                            type="button"
                            onClick={handleForgotPassword}
                            disabled={busy}
                            className="text-xs font-medium text-[var(--muted)] underline-offset-2 hover:underline disabled:opacity-50"
                          >
                            Forgot password?
                          </button>
                        )}
                      </div>
                      <Input
                        id="password"
                        type="password"
                        required
                        minLength={8}
                        autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                        placeholder="At least 8 characters"
                        value={password}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                        className="focus-visible:ring-2 focus-visible:ring-[var(--teal)]"
                        aria-invalid={error ? true : undefined}
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={busy}>
                      {submitting === "password" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {mode === "sign-in"
                        ? submitting === "password" ? "Signing in…" : "Sign in"
                        : submitting === "password" ? "Creating account…" : "Create account"}
                    </Button>

                    {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}

                    <button
                      type="button"
                      onClick={() => { setMagicLinkOpen(true); setError(null); }}
                      disabled={busy}
                      className="block w-full text-center text-xs font-medium text-[var(--muted)] underline-offset-2 hover:underline disabled:opacity-50"
                    >
                      Email me a sign-in link instead
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleMagicLink} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="magic-email">Work email</Label>
                      <Input
                        id="magic-email"
                        type="email"
                        required
                        autoComplete="email"
                        placeholder="you@company.com"
                        value={email}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                        className="focus-visible:ring-2 focus-visible:ring-[var(--teal)]"
                        aria-invalid={error ? true : undefined}
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={busy}>
                      {submitting === "magic-link" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {submitting === "magic-link" ? "Sending link…" : "Send sign-in link"}
                    </Button>

                    {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}

                    <button
                      type="button"
                      onClick={() => { setMagicLinkOpen(false); setError(null); }}
                      disabled={busy}
                      className="block w-full text-center text-xs font-medium text-[var(--muted)] underline-offset-2 hover:underline disabled:opacity-50"
                    >
                      Use a password instead
                    </button>
                  </form>
                )}
              </TabsContent>
            </Tabs>

            {oauthEnabled && (
              <>
                <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wide text-[var(--muted)]">
                  <span className="h-px flex-1 bg-[var(--line)]" />
                  or
                  <span className="h-px flex-1 bg-[var(--line)]" />
                </div>

                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={busy}
                    onClick={() => handleOAuth("google")}
                  >
                    {submitting === "google" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <GoogleIcon />
                    )}
                    <span className="ml-2">{submitting === "google" ? "Redirecting…" : "Continue with Google"}</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={busy}
                    onClick={() => handleOAuth("azure")}
                  >
                    {submitting === "azure" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <MicrosoftIcon />
                    )}
                    <span className="ml-2">
                      {submitting === "azure" ? "Redirecting…" : "Continue with Microsoft"}
                    </span>
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
