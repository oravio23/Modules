import { ALL_PROFILES } from "../../../../../supabase/functions/_shared/profiles/index.ts";
import type { DocumentProfile } from "./types.ts";

/**
 * Built-in profile definitions, read directly from the same source the
 * pipeline uses server-side. In normal operation the frontend instead reads
 * the `profiles` table (seeded from these same definitions — see
 * supabase/seed.sql) so it reflects whatever's actually active in the
 * database, including any profile added later without a code change. This
 * function is the fallback/offline view and what the Profiles page uses
 * before Supabase is wired up.
 */
export async function loadBuiltInProfiles(): Promise<DocumentProfile[]> {
  return ALL_PROFILES;
}
