import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DUR_BASE, EASE_OUT, useMotionSafe } from "@/components/oravio/motion";
import { supabase } from "@/integrations/supabase/client";

type Submitting = "idle" | "magic-link" | "google" | "azure";

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
 * No password field, ever — SSO for this platform means magic link + Google + Microsoft.
 * Passwordless removes reset flows and credential storage entirely.
 */
export function LoginCard() {
  const [email, setEmail] = React.useState("");
  const [submitting, setSubmitting] = React.useState<Submitting>("idle");
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [params] = useSearchParams();
  const motionSafe = useMotionSafe();

  // Forward the deep link a signed-out user was bounced from (set by ProtectedRoute) through
  // whichever auth flow they use, so AuthCallback can send them back to it instead of
  // defaulting to /hub. Only accept a same-app relative path, never an absolute/external URL.
  const next = params.get("next");
  const redirectTo = `${window.location.origin}/auth/callback${
    next && next.startsWith("/") ? `?next=${encodeURIComponent(next)}` : ""
  }`;

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
    setSent(true);
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
              We sent a sign-in link to <span className="font-medium text-[var(--ink)]">{email}</span>.
            </p>
            <Button variant="link" className="mt-2" onClick={() => setSent(false)}>
              Use a different email
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
            <form onSubmit={handleMagicLink} className="space-y-4">
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
              <Button type="submit" className="w-full" disabled={submitting !== "idle"}>
                {submitting === "magic-link" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {submitting === "magic-link" ? "Sending link…" : "Continue with email"}
              </Button>
            </form>

            {error && <p className="mt-3 text-sm text-[var(--destructive)]">{error}</p>}

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
                disabled={submitting !== "idle"}
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
                disabled={submitting !== "idle"}
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
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
