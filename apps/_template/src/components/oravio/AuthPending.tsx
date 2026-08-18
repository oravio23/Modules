import { motion } from "framer-motion";
import { useMotionSafe } from "./motion";

/**
 * What AuthCallback shows while waiting for the session to land (supabase-js already
 * exchanged the URL's magic-link/OAuth code by the time that route mounts — this is purely
 * the "hang on" state, before AuthCallback's own 8s timeout either redirects or gives up).
 * Previously that wait rendered nothing at all.
 */
function AuthPending() {
  const motionSafe = useMotionSafe();
  return (
    <div className="flex min-h-svh items-center justify-center px-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <motion.span
          aria-hidden
          className="h-8 w-8 rounded-full border-2 border-[var(--line)] border-t-[var(--teal)]"
          animate={motionSafe ? { rotate: 360 } : undefined}
          transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
        />
        <p className="text-sm text-[var(--muted)]">Signing you in…</p>
      </div>
    </div>
  );
}

export { AuthPending };
