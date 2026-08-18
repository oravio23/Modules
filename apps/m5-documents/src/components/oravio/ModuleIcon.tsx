import * as React from "react";
import { Package, Ship, Radar, ShieldCheck, ScanText, Calculator, type LucideProps } from "lucide-react";
import { cn } from "@/lib/utils";

const ICON_BY_MODULE_ID: Record<string, React.ComponentType<LucideProps>> = {
  m1: Package, // Sourcing & Supplier Management
  m2: Ship, // Booking & Freight Coordination
  m3: Radar, // Shipment Visibility
  m4: ShieldCheck, // Customs & Clearance Agent
  m5: ScanText, // Document Intelligence
  m6: Calculator, // Landed Cost & Reconciliation
};

export interface ModuleIconProps extends LucideProps {
  moduleId: string;
}

/** One line glyph per module, keyed by platform.modules.id — falls back to Package for an unknown id. */
function ModuleIcon({ moduleId, className, ...props }: ModuleIconProps) {
  const Icon = ICON_BY_MODULE_ID[moduleId] ?? Package;
  return <Icon className={cn("h-5 w-5", className)} strokeWidth={1.75} {...props} />;
}

export { ModuleIcon };
