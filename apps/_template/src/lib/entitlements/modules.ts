/**
 * The six-module catalogue, mirroring platform.modules (see
 * supabase/migrations/0001_platform_core.sql) so the hub can render module cards before
 * useEntitlements() resolves, instead of waiting on a round-trip for content that never
 * changes. If these two ever drift, the migration is the source of truth — update this
 * file to match it, not the other way around.
 */
export interface ModuleDefinition {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  personas: string[];
  status: "live" | "beta" | "planned";
  route: string;
  sortOrder: number;
}

export const MODULES: ModuleDefinition[] = [
  {
    id: "m1",
    slug: "sourcing",
    name: "Sourcing & Supplier Management",
    tagline:
      "POs, supplier acknowledgements, compliance documents, and supplier scorecards before cargo moves.",
    personas: ["suppliers", "importers", "exporters"],
    status: "planned",
    route: "/m1",
    sortOrder: 1,
  },
  {
    id: "m2",
    slug: "booking",
    name: "Booking & Freight Coordination",
    tagline: "Carrier booking, ETD confirmation, multi-modal coordination, and booking-to-tracking handoff.",
    personas: ["exporters", "importers", "forwarders"],
    status: "planned",
    route: "/m2",
    sortOrder: 2,
  },
  {
    id: "m3",
    slug: "visibility",
    name: "Shipment Visibility",
    tagline:
      "Live dashboard for inbound and outbound shipments with ETAs, milestones, documents, owners, and audit trail.",
    personas: ["importers", "exporters", "suppliers"],
    status: "live",
    route: "/m3",
    sortOrder: 3,
  },
  {
    id: "m4",
    slug: "customs",
    name: "Customs & Clearance Agent",
    tagline: "Arabic and English HS classification, tariff context, confidence scoring, and ASYCUDA-ready output.",
    personas: ["customs brokers", "importers"],
    status: "planned",
    route: "/m4",
    sortOrder: 4,
  },
  {
    id: "m5",
    slug: "documents",
    name: "Document Intelligence",
    tagline: "Shipping line email parsing and OCR for BLs, COOs, invoices, releases, and payment proof.",
    personas: ["forwarders", "brokers", "importers"],
    status: "planned",
    route: "/m5",
    sortOrder: 5,
  },
  {
    id: "m6",
    slug: "landed-cost",
    name: "Landed Cost & Reconciliation",
    tagline: "Duty, VAT, freight, clearance, transport, and invoice variance reconciled per shipment and SKU.",
    personas: ["importers", "exporters", "finance teams"],
    status: "planned",
    route: "/m6",
    sortOrder: 6,
  },
];
