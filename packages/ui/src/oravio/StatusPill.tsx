import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useMotionSafe } from "./motion";

const statusPillVariants = cva(
  "inline-flex items-center gap-1.5 rounded-[99px] px-2.5 py-1 text-xs font-extrabold",
  {
    variants: {
      variant: {
        live: "bg-[var(--teal)] text-white",
        planned: "bg-[var(--line)] text-[var(--muted)]",
        locked: "bg-[var(--line)] text-[var(--muted)]",
        beta: "bg-[var(--blue)] text-white",
      },
    },
    defaultVariants: { variant: "planned" },
  },
);

export interface StatusPillProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusPillVariants> {}

/** The `live` variant gets a pulsing dot — every other variant is a plain pill. */
function StatusPill({ className, variant, children, ...props }: StatusPillProps) {
  const motionSafe = useMotionSafe();
  return (
    <span className={cn(statusPillVariants({ variant }), className)} {...props}>
      {variant === "live" && (
        <motion.span
          aria-hidden
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-white"
          animate={motionSafe ? { opacity: [1, 0.4, 1], scale: [1, 0.85, 1] } : undefined}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      {children}
    </span>
  );
}

export { StatusPill, statusPillVariants };
