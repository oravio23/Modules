import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const statusPillVariants = cva(
  "inline-flex items-center rounded-[99px] px-2.5 py-1 text-xs font-extrabold",
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

function StatusPill({ className, variant, ...props }: StatusPillProps) {
  return <span className={cn(statusPillVariants({ variant }), className)} {...props} />;
}

export { StatusPill, statusPillVariants };
