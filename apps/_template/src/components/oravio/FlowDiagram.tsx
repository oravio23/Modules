import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useMotionSafe } from "./motion";

const STAGES = [
  { label: "Supplier", x: 90, color: "var(--teal)" },
  { label: "Forwarder", x: 330, color: "var(--blue)" },
  { label: "Customs", x: 570, color: "var(--amber)" },
  { label: "Importer", x: 810, color: "var(--navy)" },
] as const;

const LOOP_DURATION = 8; // seconds — one full corridor transit
const TRACK_Y = 88;
const DOC_Y = 40;

export type FlowDiagramProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * The landing page's "one shipment record" illustration: a shipment travelling the
 * supplier -> forwarder -> customs -> importer corridor, each stage lighting up as it
 * arrives, with a couple of document glyphs resolving along the way. Purely decorative
 * (the hero copy already states the same story in words) — aria-hidden rather than
 * described, to avoid a redundant screen-reader announcement.
 *
 * Renders as a static (unanimated) diagram, marker parked at the first stage, when
 * useMotionSafe() is false.
 */
const FlowDiagram = React.forwardRef<HTMLDivElement, FlowDiagramProps>(({ className, ...props }, ref) => {
  const motionSafe = useMotionSafe();

  return (
    <div ref={ref} aria-hidden className={cn("w-full", className)} {...props}>
      <svg viewBox="0 0 900 160" className="h-auto w-full" xmlns="http://www.w3.org/2000/svg">
        {/* corridor line */}
        <line
          x1={STAGES[0].x}
          y1={TRACK_Y}
          x2={STAGES[STAGES.length - 1].x}
          y2={TRACK_Y}
          stroke="var(--line)"
          strokeWidth={1.5}
          strokeDasharray="1 7"
        />

        {/* document glyphs resolving mid-corridor */}
        {[210, 690].map((x, i) => (
          <motion.g
            key={x}
            initial={{ opacity: 0, y: 6 }}
            animate={
              motionSafe
                ? { opacity: [0, 1, 1, 0], y: [6, 0, 0, -6] }
                : { opacity: 0 }
            }
            transition={{
              duration: LOOP_DURATION,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * (LOOP_DURATION / 2),
            }}
          >
            <rect x={x - 9} y={DOC_Y - 11} width={18} height={22} rx={2} fill="var(--panel)" stroke="var(--line)" />
            <line x1={x - 5} y1={DOC_Y - 5} x2={x + 5} y2={DOC_Y - 5} stroke="var(--muted)" strokeWidth={1.2} />
            <line x1={x - 5} y1={DOC_Y} x2={x + 5} y2={DOC_Y} stroke="var(--muted)" strokeWidth={1.2} />
            <line x1={x - 5} y1={DOC_Y + 5} x2={x + 1} y2={DOC_Y + 5} stroke="var(--muted)" strokeWidth={1.2} />
          </motion.g>
        ))}

        {/* stage nodes */}
        {STAGES.map((stage, i) => {
          const delay = motionSafe ? (i / (STAGES.length - 1)) * LOOP_DURATION : 0;
          return (
            <g key={stage.label}>
              <motion.circle
                cx={stage.x}
                cy={TRACK_Y}
                r={7}
                fill="var(--panel)"
                stroke={stage.color}
                strokeWidth={2}
                animate={
                  motionSafe
                    ? { scale: [1, 1.35, 1] }
                    : undefined
                }
                style={{ transformOrigin: `${stage.x}px ${TRACK_Y}px` }}
                transition={{ duration: LOOP_DURATION, repeat: Infinity, ease: "easeInOut", delay }}
              />
              <text
                x={stage.x}
                y={TRACK_Y + 34}
                textAnchor="middle"
                fontSize={13}
                fontWeight={800}
                fill="var(--navy)"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                {stage.label}
              </text>
            </g>
          );
        })}

        {/* travelling shipment marker */}
        <motion.rect
          y={TRACK_Y - 6}
          width={16}
          height={12}
          rx={2}
          fill="var(--teal)"
          initial={{ x: STAGES[0].x - 8 }}
          animate={
            motionSafe
              ? { x: STAGES.map((s) => s.x - 8) }
              : undefined
          }
          transition={{ duration: LOOP_DURATION, repeat: Infinity, ease: "easeInOut", times: STAGES.map((_, i) => i / (STAGES.length - 1)) }}
        />
      </svg>
    </div>
  );
});
FlowDiagram.displayName = "FlowDiagram";

export { FlowDiagram };
