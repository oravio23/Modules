import * as React from "react";
import { cn } from "@/lib/utils";

/** oravio.co's roadmap-section treatment: navy background, white text, navy-soft panels inside. */
const InvertedSection = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => (
    <section
      ref={ref}
      className={cn(
        "bg-[var(--navy)] px-[clamp(18px,4vw,56px)] py-[78px] text-white",
        "[&_h2]:text-white [&_.eyebrow]:text-[var(--teal-bright)]",
        className,
      )}
      {...props}
    />
  ),
);
InvertedSection.displayName = "InvertedSection";

export { InvertedSection };
