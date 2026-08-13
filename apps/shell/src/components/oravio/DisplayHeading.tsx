import * as React from "react";
import { cn } from "@/lib/utils";

export interface DisplayHeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  level?: 1 | 2 | 3;
}

/** oravio.co's clamp() display type scale: h1 62-118px/0.88, h2 30-52px/1.02, h3 21px/1.15. */
const DisplayHeading = React.forwardRef<HTMLHeadingElement, DisplayHeadingProps>(
  ({ className, level = 1, ...props }, ref) => {
    const Comp = (`h${level}` as unknown) as "h1" | "h2" | "h3";
    const scale =
      level === 1
        ? "max-w-[620px] text-[clamp(62px,8vw,118px)] leading-[0.88]"
        : level === 2
          ? "max-w-[680px] text-[clamp(30px,4vw,52px)] leading-[1.02]"
          : "text-[21px] leading-[1.15]";
    return (
      <Comp
        ref={ref as never}
        className={cn(scale, "m-0 font-normal text-[var(--navy)]", className)}
        {...props}
      />
    );
  },
);
DisplayHeading.displayName = "DisplayHeading";

export { DisplayHeading };
