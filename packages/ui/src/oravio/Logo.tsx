import * as React from "react";
import { cn } from "@/lib/utils";

export interface LogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /**
   * Path to the Oravio mark. Defaults to a placeholder wordmark shipped in each app's
   * public/oravio-logo.svg — swap that file for the real mark (ask Wael for an SVG; the
   * live site only has a PNG) rather than changing this default, so every app picks it up
   * automatically.
   */
  src?: string;
}

/**
 * Reproduces oravio.co's header logo treatment exactly: object-fit:contain,
 * mix-blend-mode:multiply (so the logo's white background disappears on any panel color),
 * 230x72 desktop / 170x54 mobile per the site's own breakpoint.
 */
const Logo = React.forwardRef<HTMLImageElement, LogoProps>(
  ({ className, src = "/oravio-logo.svg", alt = "Oravio", ...props }, ref) => (
    <img
      ref={ref}
      src={src}
      alt={alt}
      className={cn(
        "h-[54px] w-[170px] object-contain object-left [mix-blend-mode:multiply] sm:h-[72px] sm:w-[230px]",
        className,
      )}
      {...props}
    />
  ),
);
Logo.displayName = "Logo";

export { Logo };
