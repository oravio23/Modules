import * as React from "react";
import { cn } from "@/lib/utils";

export interface EyebrowProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** "inverted" lightens the teal to #63cbc4 for use on navy backgrounds, matching oravio.co's roadmap section. */
  tone?: "default" | "inverted";
  as?: "span" | "div" | "p";
}

const Eyebrow = React.forwardRef<HTMLSpanElement, EyebrowProps>(
  ({ className, tone = "default", as: Comp = "span", ...props }, ref) => (
    <Comp
      // @ts-expect-error -- polymorphic element, ref typing kept simple on purpose
      ref={ref}
      className={cn(
        // "eyebrow" is a stable hook, not a styling class — InvertedSection's
        // `[&_.eyebrow]:text-[#63cbc4]` descendant selector matches on it so an Eyebrow
        // nested inside an inverted section lightens automatically without needing
        // tone="inverted" passed explicitly at every call site.
        "eyebrow block text-[12px] font-extrabold uppercase tracking-[0.08em]",
        tone === "inverted" ? "text-[#63cbc4]" : "text-[var(--teal)]",
        className,
      )}
      {...props}
    />
  ),
);
Eyebrow.displayName = "Eyebrow";

export { Eyebrow };
