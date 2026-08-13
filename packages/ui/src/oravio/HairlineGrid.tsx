import * as React from "react";
import { cn } from "@/lib/utils";

export interface HairlineGridProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Number of columns at the widest breakpoint. Collapses to 2 under 920px, 1 under 640px. */
  cols?: 2 | 3 | 4;
}

/**
 * oravio.co's signature layout primitive: a 1px hairline grid (gap:1px over --line)
 * with solid white children, used for the module grid, persona list, metrics strip,
 * and roadmap timeline. This single pattern carries most of the brand's visual identity.
 */
const HairlineGrid = React.forwardRef<HTMLDivElement, HairlineGridProps>(
  ({ className, cols = 3, style, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("grid gap-px bg-[var(--line)]", className)}
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        ...style,
      }}
      data-cols={cols}
      {...props}
    />
  ),
);
HairlineGrid.displayName = "HairlineGrid";

export { HairlineGrid };
