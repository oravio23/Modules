import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useMotionSafe } from "./motion";

/**
 * Dark counterpart to AuroraBackdrop, for the "operations portal" chrome after sign-in
 * (Hub and everything behind ProtectedRoute). Navy base (--app-bg), a --navy-soft radial
 * glow in place of AuroraBackdrop's teal one, and the same hairline grid at a low alpha
 * tuned for a dark surface instead of a light one.
 */
const AppBackdrop = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const motionSafe = useMotionSafe();
    return (
      <div
        ref={ref}
        className={cn("relative overflow-hidden bg-[var(--app-bg)] text-[var(--app-text)]", className)}
        {...props}
      >
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -inset-1/3"
          style={{ background: "radial-gradient(circle, rgba(99,203,196,0.14), transparent 45%)" }}
          animate={
            motionSafe
              ? { x: ["0%", "-6%", "5%", "0%"], y: ["0%", "6%", "-4%", "0%"] }
              : undefined
          }
          transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: [
              "linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
              "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)",
            ].join(", "),
            backgroundSize: "56px 56px, 56px 56px",
          }}
        />
        <div className="relative">{children}</div>
      </div>
    );
  },
);
AppBackdrop.displayName = "AppBackdrop";

export { AppBackdrop };
