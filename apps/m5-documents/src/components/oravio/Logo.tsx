import * as React from "react";
import { cn } from "@/lib/utils";

export interface LogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /**
   * Path to the Oravio mark. Defaults to a placeholder wordmark shipped in each app's
   * public/oravio-logo.svg — swap that file for the real mark rather than changing this
   * default, so every app picks it up automatically.
   */
  src?: string;
  /**
   * "light" (default) applies mix-blend-mode:multiply, which removes the logo's white
   * background on any light panel — oravio.co's own header treatment. "dark" skips the
   * blend mode for use on the navy portal chrome, where multiply would darken the mark
   * toward invisible instead of removing a background. The placeholder mark itself is
   * still the navy/light wordmark either way until the real asset (with a light variant
   * for dark surfaces) is in.
   */
  tone?: "light" | "dark";
}

/**
 * Reproduces oravio.co's header logo treatment: object-fit:contain, 230x72 desktop /
 * 170x54 mobile per the site's own breakpoint, mix-blend-mode:multiply on light panels only.
 */
const Logo = React.forwardRef<HTMLImageElement, LogoProps>(
  ({ className, src = "/oravio-logo.svg", alt = "Oravio", tone = "light", ...props }, ref) => (
    <img
      ref={ref}
      src={src}
      alt={alt}
      className={cn(
        "h-[54px] w-[170px] object-contain object-left sm:h-[72px] sm:w-[230px]",
        tone === "light" && "[mix-blend-mode:multiply]",
        className,
      )}
      {...props}
    />
  ),
);
Logo.displayName = "Logo";

export { Logo };
