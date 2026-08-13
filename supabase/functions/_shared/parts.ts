/** Shared between the browser ingest normalisers and the edge-function pipeline — one definition of what a "document part" is. */
export type PartKind = "page" | "sheet" | "slide" | "attachment" | "text";
