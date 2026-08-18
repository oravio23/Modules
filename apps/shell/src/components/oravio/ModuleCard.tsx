import * as React from "react";
import { Lock } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Eyebrow } from "./Eyebrow";
import { StatusPill, type StatusPillProps } from "./StatusPill";
import { ModuleIcon } from "./ModuleIcon";
import { DUR_BASE, EASE_OUT, cardHoverTransition, useMotionSafe } from "./motion";

const TOP_BORDER_CYCLE = ["var(--navy)", "var(--teal)", "var(--blue)"] as const;

// motion.div redefines onDrag/onDragStart/onDragEnd/onAnimationStart with a gesture-callback
// signature (event, PanInfo) instead of the plain DOM event React.HTMLAttributes expects —
// omit them from the base type rather than fighting the two conflicting signatures.
type DivPropsWithoutMotionConflicts = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart" | "onAnimationEnd"
>;

export interface ModuleCardProps extends DivPropsWithoutMotionConflicts {
  /** platform.modules.id ('m1'..'m6') — drives the icon; falls back to a generic glyph for an unknown id. */
  moduleId: string;
  /** 0-based position in the grid — drives the navy/teal/blue 3px top-border cycle from oravio.co. */
  index: number;
  eyebrow: string;
  title: string;
  personas: string[];
  description: string;
  status: StatusPillProps["variant"];
  statusLabel: string;
  /** Rendered as a link when the module is open to this user; plain div otherwise (locked/planned). */
  href?: string;
  /** "light" for the landing-page module strip, "dark" for the post-login portal (Hub). */
  tone?: "light" | "dark";
}

const TONE_CLASSES = {
  light: {
    card: "border-[var(--line)] bg-[var(--panel)]",
    title: "text-[var(--navy)]",
    body: "text-[var(--muted)]",
  },
  dark: {
    card: "border-[var(--app-line)] bg-[var(--app-surface)]",
    title: "text-[var(--app-text)]",
    body: "text-[var(--app-text-muted)]",
  },
} as const;

/**
 * Reproduces oravio.co's `.module-card`: 1px line border, 3px top border cycling
 * navy -> teal -> blue by index, eyebrow ("MODULE 03"), title, persona line, body, status pill.
 * v2 adds: a per-module line glyph, a motion lift + teal glow on hover for openable cards,
 * a staggered entry (pair with `stagger()` on the parent grid), and an explicit dimmed +
 * locked-icon treatment instead of relying on the status pill's label alone.
 */
const ModuleCard = React.forwardRef<HTMLDivElement, ModuleCardProps>(
  (
    {
      className,
      moduleId,
      index,
      eyebrow,
      title,
      personas,
      description,
      status,
      statusLabel,
      href,
      tone = "light",
      children,
      ...props
    },
    ref,
  ) => {
    const motionSafe = useMotionSafe();
    const isOpenable = Boolean(href);
    const isLocked = status === "locked";
    const tones = TONE_CLASSES[tone];

    // Self-contained entrance animation (explicit initial/animate, not inherited variants
    // from a parent stagger container) — the index-based delay reproduces the same
    // staggered-reveal feel without depending on ambient variant-context propagation from
    // whatever wraps this card on a given page.
    const content = (
      <motion.div
        ref={ref}
        initial={motionSafe ? { opacity: 0, y: 16 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DUR_BASE, ease: EASE_OUT, delay: motionSafe ? index * 0.06 : 0 }}
        whileHover={
          motionSafe && isOpenable
            ? { y: -4, boxShadow: "0 0 0 1px var(--teal), var(--shadow-md)", transition: cardHoverTransition }
            : undefined
        }
        className={cn(
          "relative flex min-h-[250px] flex-col gap-3 border p-7",
          tones.card,
          isLocked && "opacity-60",
          className,
        )}
        style={{ borderTop: `3px solid ${TOP_BORDER_CYCLE[index % 3]}` }}
        {...props}
      >
        {isLocked && (
          <Lock aria-hidden className="absolute right-5 top-5 h-4 w-4" style={{ color: "var(--muted)" }} />
        )}
        <ModuleIcon moduleId={moduleId} className={cn(tone === "dark" ? "text-[var(--teal-bright)]" : "text-[var(--teal)]")} />
        <Eyebrow className="mb-2">{eyebrow}</Eyebrow>
        <strong className={cn("mb-1 block text-sm font-bold", tones.title)}>{title}</strong>
        <p className={cn("m-0 text-sm", tones.body)}>{personas.join(" · ")}</p>
        <p className={cn("m-0 flex-1 text-[15px] leading-relaxed", tones.body)}>{description}</p>
        <div className="flex items-center justify-between pt-2">
          <StatusPill variant={status}>{statusLabel}</StatusPill>
          {children}
        </div>
      </motion.div>
    );

    if (href) {
      return (
        <a href={href} className="contents no-underline">
          {content}
        </a>
      );
    }
    return content;
  },
);
ModuleCard.displayName = "ModuleCard";

export { ModuleCard };
