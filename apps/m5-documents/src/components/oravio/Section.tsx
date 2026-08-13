import * as React from "react";
import { cn } from "@/lib/utils";

/** oravio.co's section rhythm: max-width 1180px, 78px vertical padding, clamp() gutter. */
const Section = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => (
    <section
      ref={ref}
      className={cn("mx-auto max-w-[1180px] px-[clamp(18px,4vw,56px)] py-[78px]", className)}
      {...props}
    />
  ),
);
Section.displayName = "Section";

const Container = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("mx-auto max-w-[1180px] px-[clamp(18px,4vw,56px)]", className)} {...props} />
  ),
);
Container.displayName = "Container";

export { Section, Container };
