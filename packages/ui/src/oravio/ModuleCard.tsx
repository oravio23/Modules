import * as React from "react";
import { cn } from "@/lib/utils";
import { Eyebrow } from "./Eyebrow";
import { StatusPill, type StatusPillProps } from "./StatusPill";

const TOP_BORDER_CYCLE = ["var(--navy)", "var(--teal)", "var(--blue)"] as const;

export interface ModuleCardProps extends React.HTMLAttributes<HTMLDivElement> {
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
}

/**
 * Reproduces oravio.co's `.module-card`: 1px line border, 3px top border cycling
 * navy -> teal -> blue by index, eyebrow ("MODULE 03"), title, persona line, body, status pill.
 */
const ModuleCard = React.forwardRef<HTMLDivElement, ModuleCardProps>(
  (
    { className, index, eyebrow, title, personas, description, status, statusLabel, href, children, ...props },
    ref,
  ) => {
    const content = (
      <div
        ref={ref}
        className={cn(
          "flex min-h-[250px] flex-col gap-3 border border-[var(--line)] bg-[var(--panel)] p-7",
          className,
        )}
        style={{ borderTop: `3px solid ${TOP_BORDER_CYCLE[index % 3]}` }}
        {...props}
      >
        <Eyebrow className="mb-2">{eyebrow}</Eyebrow>
        <strong className="mb-1 block text-sm font-bold text-[var(--navy)]">{title}</strong>
        <p className="m-0 text-sm text-[var(--muted)]">{personas.join(" · ")}</p>
        <p className="m-0 flex-1 text-[15px] leading-relaxed text-[var(--muted)]">{description}</p>
        <div className="flex items-center justify-between pt-2">
          <StatusPill variant={status}>{statusLabel}</StatusPill>
          {children}
        </div>
      </div>
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
