import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * oravio.co's hero background: a teal radial glow at 12%/18% plus a 56px hairline grid,
 * reproduced from the measured `.hero` background-image stack in oravio.co/style.css.
 */
const GridBackdrop = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, style, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("border-b border-[var(--line)] bg-[#f8fafc]", className)}
      style={{
        backgroundImage: [
          "radial-gradient(circle at 12% 18%, #087c751a, transparent 28%)",
          "linear-gradient(90deg, #1118320b 1px, transparent 1px)",
          "linear-gradient(#1118320b 1px, transparent 1px)",
        ].join(", "),
        backgroundSize: "100% 100%, 56px 56px, 56px 56px",
        ...style,
      }}
      {...props}
    />
  ),
);
GridBackdrop.displayName = "GridBackdrop";

export { GridBackdrop };
