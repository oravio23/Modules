import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useMotionSafe } from "./motion";

/**
 * Upgrade of GridBackdrop for the light pages (landing, sign-in): the same 56px hairline
 * grid + teal radial glow measured off oravio.co, but the glow now drifts slowly instead of
 * sitting still. Split into two layers instead of GridBackdrop's single flat
 * `backgroundImage` stack specifically so the glow can be a `motion.div` — Framer Motion
 * can't animate a `background-image` gradient's position directly. Gated on
 * `useMotionSafe()`: with reduced motion requested, the glow renders in its resting position
 * and simply doesn't move.
 */
const AuroraBackdrop = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const motionSafe = useMotionSafe();
    return (
      <div
        ref={ref}
        className={cn("relative overflow-hidden border-b border-[var(--line)] bg-[#f8fafc]", className)}
        {...props}
      >
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -inset-1/3"
          style={{ background: "radial-gradient(circle, #087c751a, transparent 45%)" }}
          animate={
            motionSafe
              ? { x: ["0%", "8%", "-4%", "0%"], y: ["0%", "-6%", "5%", "0%"] }
              : undefined
          }
          transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: [
              "linear-gradient(90deg, #1118320b 1px, transparent 1px)",
              "linear-gradient(#1118320b 1px, transparent 1px)",
            ].join(", "),
            backgroundSize: "56px 56px, 56px 56px",
          }}
        />
        <div className="relative">{children}</div>
      </div>
    );
  },
);
AuroraBackdrop.displayName = "AuroraBackdrop";

export { AuroraBackdrop };
