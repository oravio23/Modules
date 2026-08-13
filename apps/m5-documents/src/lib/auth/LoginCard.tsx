import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

type Submitting = "idle" | "magic-link" | "google" | "azure";

/**
 * No password field, ever — SSO for this platform means magic link + Google + Microsoft.
 * Passwordless removes reset flows and credential storage entirely.
 */
export function LoginCard() {
  const [email, setEmail] = React.useState("");
  const [submitting, setSubmitting] = React.useState<Submitting>("idle");
  const [sent, setSent] = React.useState(false);
  const [params] = useSearchParams();

  // Forward the deep link a signed-out user was bounced from (set by ProtectedRoute) through
  // whichever auth flow they use, so AuthCallback can send them back to it instead of
  // defaulting to /hub. Only accept a same-app relative path, never an absolute/external URL.
  const next = params.get("next");
  const redirectTo = `${window.location.origin}/auth/callback${
    next && next.startsWith("/") ? `?next=${encodeURIComponent(next)}` : ""
  }`;

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setSubmitting("magic-link");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    setSubmitting("idle");
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
  }

  async function handleOAuth(provider: "google" | "azure") {
    setSubmitting(provider);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (error) {
      setSubmitting("idle");
      toast.error(error.message);
    }
    // On success the browser navigates away to the provider; nothing else to do here.
  }

  if (sent) {
    return (
      <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-8 text-center">
        <p className="text-sm font-semibold text-[var(--navy)]">Check your email</p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          We sent a sign-in link to <span className="font-medium text-[var(--ink)]">{email}</span>.
        </p>
        <Button variant="link" className="mt-2" onClick={() => setSent(false)}>
          Use a different email
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-8">
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
          />
        </div>
        <Button type="submit" className="w-full" disabled={submitting !== "idle"}>
          {submitting === "magic-link" ? "Sending link…" : "Continue with email"}
        </Button>
      </form>

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
          {submitting === "google" ? "Redirecting…" : "Continue with Google"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={submitting !== "idle"}
          onClick={() => handleOAuth("azure")}
        >
          {submitting === "azure" ? "Redirecting…" : "Continue with Microsoft"}
        </Button>
      </div>
    </div>
  );
}
