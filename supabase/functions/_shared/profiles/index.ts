import { GENERIC_PROFILE } from "./generic.ts";
import { COMMERCIAL_INVOICE_PROFILE } from "./commercial-invoice.ts";
import type { DocumentProfileDefinition } from "./types.ts";

export const ALL_PROFILES: DocumentProfileDefinition[] = [GENERIC_PROFILE, COMMERCIAL_INVOICE_PROFILE];

export const PROFILES_BY_ID: Record<string, DocumentProfileDefinition> = Object.fromEntries(
  ALL_PROFILES.map((p) => [p.id, p]),
);

export { GENERIC_PROFILE, COMMERCIAL_INVOICE_PROFILE };
export * from "./types.ts";
