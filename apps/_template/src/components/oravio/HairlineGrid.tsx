import * as React from "react";
import { cn } from "@/lib/utils";

export interface HairlineGridProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Number of columns at the widest breakpoint. Collapses to 2 under 920px, 1 under 640px. */
  cols?: 2 | 3 | 4;
}

// Static class strings (not template-built) so Tailwind's JIT scanner finds every one of
// them regardless of which `cols` value actually renders. Matches oravio.co's own
// module-grid breakpoints (920px, 640px) via arbitrary-value variants, since Tailwind's
// default breakpoints (768/1024) don't land there.
const COLS_CLASSES: Record<2 | 3 | 4, string> = {
  2: "grid-cols-1 min-[640px]:grid-cols-2",
  3: "grid-cols-1 min-[640px]:grid-cols-2 min-[920px]:grid-cols-3",
  4: "grid-cols-1 min-[640px]:grid-cols-2 min-[920px]:grid-cols-4",
};

/**
 * oravio.co's signature layout primitive: a 1px hairline grid (gap:1px over --line)
 * with solid white children, used for the module grid, persona list, metrics strip,
 * and roadmap timeline. This single pattern carries most of the brand's visual identity.
 */
const HairlineGrid = React.forwardRef<HTMLDivElement, HairlineGridProps>(
  ({ className, cols = 3, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("grid gap-px bg-[var(--line)]", COLS_CLASSES[cols], className)}
      data-cols={cols}
      {...props}
    />
  ),
);
HairlineGrid.displayName = "HairlineGrid";

export { HairlineGrid };
