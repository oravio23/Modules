#!/usr/bin/env node
// Vendors the subset of supabase/functions/_shared/ that src/ needs AT RUNTIME (not just
// for types) into src/lib/_shared-vendor/, so this app stays a flat, standalone Vite
// project — droppable into Lovable with no monorepo above it — the same reason
// scripts/sync-ui.mjs exists at the repo root for packages/ui and packages/tokens.
//
// WHY THIS EXISTS: src/lib/arabic.ts and src/lib/profiles/registry.ts used to import
// straight across the app boundary via relative paths like
// "../../../../supabase/functions/_shared/arabic.ts". That resolves today only because
// the monorepo root happens to sit four directories above this app — push
// apps/m5-documents alone as its own repo (the actual Lovable migration path) and Rollup
// fails immediately, since there is no supabase/ four levels up any more.
//
// Plain Node, no deps — matches copy-pdfjs-assets.mjs's own reasoning: this must survive
// `npm install --omit=dev` on whatever host runs the build, without needing tsx.
//
// Usage: node scripts/vendor-shared.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
// apps/m5-documents/scripts -> apps/m5-documents -> apps -> repo root
const repoRoot = path.resolve(here, "..", "..", "..");
const sharedSrc = path.join(repoRoot, "supabase", "functions", "_shared");
const vendorDest = path.join(here, "..", "src", "lib", "_shared-vendor");

// This app has been pushed out of the monorepo (the actual Lovable migration path) — there
// is no supabase/ three levels up any more. That's fine: src/lib/_shared-vendor/ is
// committed to git, not gitignored, specifically so the last-generated copy travels with
// the app folder and the build doesn't depend on this script succeeding outside the
// monorepo. Skip regenerating, keep whatever's already on disk.
if (!fs.existsSync(sharedSrc)) {
  console.log(
    `${path.relative(process.cwd(), sharedSrc)} does not exist (running outside the monorepo) — ` +
      "leaving the committed src/lib/_shared-vendor/ as-is.",
  );
  process.exit(0);
}

// Every one of these is imported by src/ — either at runtime, or only as a type but still
// resolved by `tsc -b` (which the build script also runs, and which does not erase
// type-only imports the way esbuild/Rollup does) — and has no Deno/Node-only dependency, so
// it's safe to copy verbatim. Keep this list in sync with what src/lib/arabic.ts,
// src/lib/profiles/{registry,types}.ts, src/lib/ingest/types.ts, and
// src/lib/upload/uploadDocument.ts actually import — if any of them starts reaching for
// something new here, add it to this list rather than reaching across the boundary again.
const FILES_TO_VENDOR = [
  "arabic.ts",
  "envelope-types.ts",
  "parts.ts",
  "profiles/index.ts",
  "profiles/generic.ts",
  "profiles/commercial-invoice.ts",
  "profiles/types.ts",
  "pipeline/stages.ts",
  "contracts/register.ts",
];

const HEADER =
  "// VENDORED — copied verbatim from supabase/functions/_shared by scripts/vendor-shared.mjs.\n" +
  "// Do not hand-edit: edit the source in supabase/functions/_shared and re-run\n" +
  "// `node scripts/vendor-shared.mjs` (also runs automatically on postinstall/build).\n\n";

fs.rmSync(vendorDest, { recursive: true, force: true });

for (const rel of FILES_TO_VENDOR) {
  const src = path.join(sharedSrc, rel);
  const dest = path.join(vendorDest, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const content = fs.readFileSync(src, "utf8");
  fs.writeFileSync(dest, HEADER + content, "utf8");
}

console.log(`Vendored ${FILES_TO_VENDOR.length} file(s) from supabase/functions/_shared into src/lib/_shared-vendor/`);
