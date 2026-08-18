// VENDORED — copied verbatim from supabase/functions/_shared by scripts/vendor-shared.mjs.
// Do not hand-edit: edit the source in supabase/functions/_shared and re-run
// `node scripts/vendor-shared.mjs` (also runs automatically on postinstall/build).

/** Shared between the browser ingest normalisers and the edge-function pipeline — one definition of what a "document part" is. */
export type PartKind = "page" | "sheet" | "slide" | "attachment" | "text";
