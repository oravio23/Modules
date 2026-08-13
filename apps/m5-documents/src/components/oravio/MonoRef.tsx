import * as React from "react";
import { cn } from "@/lib/utils";

/** oravio.co's treatment for BL / PO / invoice / container reference numbers: mono, weight 800. */
const MonoRef = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      className={cn("font-mono font-extrabold text-[var(--ink)]", className)}
      {...props}
    />
  ),
);
MonoRef.displayName = "MonoRef";

export { MonoRef };
