// Canonical implementation lives in supabase/functions/_shared/arabic.ts, vendored here by
// scripts/vendor-shared.mjs (see src/lib/_shared-vendor/arabic.ts) so this app stays a flat,
// standalone Vite project — no reaching outside the app boundary at runtime — while the
// review pane's RTL detection and the pipeline's evidence-anchoring gate still normalise
// text identically.
export * from "./_shared-vendor/arabic.ts";
