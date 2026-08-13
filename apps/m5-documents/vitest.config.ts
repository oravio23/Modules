import path from "node:path";
import { defineConfig } from "vitest/config";

// Covers both src/**/*.test.ts (frontend) and the shared edge-function code's own tests
// (validators, envelope assembly, anchoring gate) — the latter now live at the repo root's
// supabase/functions/_shared/ (shared across every module, not just this one), reached via
// a relative path since it's outside this app's own directory. They're plain portable
// TypeScript with no Deno-only APIs, so they run under Node/Vitest unchanged. Files that DO
// need Deno (npm:/jsr: specifiers, Deno.serve, …) are excluded — see the exclude list below.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "../../supabase/functions/_shared/**/*.test.ts"],
    exclude: [
      "**/node_modules/**",
      // Deno-only: uses npm:/jsr: specifiers and Deno globals, not resolvable by Node.
      "../../supabase/functions/_shared/anthropic.ts",
      "../../supabase/functions/_shared/supabaseAdmin.ts",
    ],
  },
});
