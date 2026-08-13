// Re-exports the canonical, portable profile types from supabase/functions/_shared —
// there is exactly one definition of what a "document profile" is, shared by
// the edge functions (Deno) and the frontend (Vite) via plain relative imports.
export type { DocumentProfileDefinition as DocumentProfile, ProfileFieldDefinition } from "../../../../../supabase/functions/_shared/profiles/types.ts";
