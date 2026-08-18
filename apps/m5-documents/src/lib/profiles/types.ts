// Re-exports the canonical, portable profile types from supabase/functions/_shared,
// vendored into src/lib/_shared-vendor by scripts/vendor-shared.mjs — there is exactly one
// definition of what a "document profile" is, shared by the edge functions (Deno) and the
// frontend (Vite).
export type { DocumentProfileDefinition as DocumentProfile, ProfileFieldDefinition } from "../_shared-vendor/profiles/types.ts";
