import * as React from "react";
import { motion } from "framer-motion";
import { DUR_BASE, EASE_OUT, useMotionSafe } from "./motion";

// motion.div redefines onDrag/onDragStart/onDragEnd/onAnimationStart with a gesture-callback
// signature (event, PanInfo) instead of the plain DOM event React.HTMLAttributes expects —
// omit them from the base type rather than fighting the two conflicting signatures.
export interface RevealProps
  extends Omit<
    React.HTMLAttributes<HTMLDivElement>,
    "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart" | "onAnimationEnd"
  > {
  delay?: number;
}

/**
 * Scroll-reveal wrapper for the landing page — fades and rises into view the first time it
 * crosses the viewport, then stays (`viewport={{ once: true }}`, no re-triggering on
 * scroll-back). Renders as a plain `div` with reduced motion, per useMotionSafe().
 */
const Reveal = React.forwardRef<HTMLDivElement, RevealProps>(({ delay = 0, children, ...props }, ref) => {
  const motionSafe = useMotionSafe();
  if (!motionSafe) {
    return (
      <div ref={ref} {...props}>
        {children}
      </div>
    );
  }
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: DUR_BASE, ease: EASE_OUT, delay }}
      {...props}
    >
      {children}
    </motion.div>
  );
});
Reveal.displayName = "Reveal";

export { Reveal };
