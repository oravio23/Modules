import * as React from "react";
import { cn } from "@/lib/utils";

export interface DisplayHeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  level?: 1 | 2 | 3;
}

const SCALE_BY_LEVEL: Record<1 | 2 | 3, { maxWidth?: string; fontSize: string; lineHeight: string }> = {
  1: { maxWidth: "620px", fontSize: "var(--text-h1-size)", lineHeight: "var(--text-h1-leading)" },
  2: { maxWidth: "680px", fontSize: "var(--text-h2-size)", lineHeight: "var(--text-h2-leading)" },
  3: { fontSize: "var(--text-h3-size)", lineHeight: "var(--text-h3-leading)" },
};

/**
 * oravio.co's clamp() display type scale — see --text-h{1,2,3}-{size,leading} in tokens.css.
 * font-size/line-height are set via inline style, not Tailwind's `text-[var(--x)]`
 * arbitrary-value syntax: tailwind-merge's conflict resolution groups any `text-[...]` class
 * under one "text color/size" bucket regardless of what the value actually is, so a
 * `text-[var(--text-h1-size)]` class and this component's own `text-[var(--navy)]` color
 * class collide and one gets silently dropped (confirmed by rendering — the heading fell
 * back to plain 1em text at 16px). Inline style has no such ambiguity.
 */
const DisplayHeading = React.forwardRef<HTMLHeadingElement, DisplayHeadingProps>(
  ({ className, level = 1, style, ...props }, ref) => {
    const Comp = (`h${level}` as unknown) as "h1" | "h2" | "h3";
    const scale = SCALE_BY_LEVEL[level];
    return (
      <Comp
        ref={ref as never}
        className={cn("m-0 font-normal text-[var(--navy)]", className)}
        style={{
          maxWidth: scale.maxWidth,
          fontSize: scale.fontSize,
          lineHeight: scale.lineHeight,
          ...style,
        }}
        {...props}
      />
    );
  },
);
DisplayHeading.displayName = "DisplayHeading";

export { DisplayHeading };
