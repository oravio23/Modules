import { useReducedMotion, type Transition, type Variants } from "framer-motion";

/**
 * One motion vocabulary for the whole platform, mirroring the duration/easing tokens
 * (--dur-fast, --dur-base, --dur-slow, --ease-out, --ease-spring) in
 * packages/tokens/src/tokens.css. Framer Motion needs plain numbers (seconds) and easing
 * arrays at the JS layer, not CSS custom properties, so these are the JS-side source of
 * truth — keep the two in sync by hand if either changes.
 */
export const DUR_FAST = 0.14;
export const DUR_BASE = 0.24;
export const DUR_SLOW = 0.42;

export const EASE_OUT = [0.2, 0.8, 0.2, 1] as const;
export const EASE_SPRING = [0.34, 1.56, 0.64, 1] as const;

/** Fade-and-rise entrance for hero copy, cards, and section headings. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: DUR_BASE, ease: EASE_OUT } },
};

/** Plain fade, for backdrops and anything a rise would be too busy for. */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: DUR_BASE, ease: EASE_OUT } },
};

/** Parent variant for a `staggerChildren`-driven reveal — pair with `fadeUp` on each child. */
export function stagger(staggerChildren = 0.06, delayChildren = 0): Variants {
  return {
    hidden: {},
    visible: { transition: { staggerChildren, delayChildren } },
  };
}

/** Shared hover/tap transition for cards and buttons — quick, not springy. */
export const cardHoverTransition: Transition = { duration: DUR_FAST, ease: EASE_OUT };

/**
 * Wraps Framer Motion's own reduced-motion signal behind one hook so every animated
 * component in this repo checks the same thing the same way, instead of each one importing
 * `useReducedMotion` and deciding for itself what "off" means. Returns `true` when it's
 * safe to animate.
 */
export function useMotionSafe(): boolean {
  const prefersReduced = useReducedMotion();
  return !prefersReduced;
}
