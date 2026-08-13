/**
 * Copies the pdf.js worker, standard fonts, and CMaps into public/pdfjs/ so
 * Vite serves them as plain static assets at a stable URL. Needed because
 * pdf.js's worker and font-substitution data can't be bundled as ordinary
 * ES module imports — pdf.js loads them at runtime by URL.
 *
 * Runs as part of the "build" script (see package.json) rather than
 * "postinstall" — postinstall ran via tsx, a devDependency, which fails
 * under any install that omits devDependencies. Plain .mjs with only
 * node: built-ins needs no dependency at all to run.
 */
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const pkgDir = path.join(root, "node_modules", "pdfjs-dist");
const outDir = path.join(root, "public", "pdfjs");

if (!existsSync(pkgDir)) {
  console.error("pdfjs-dist not found in node_modules — run npm install first.");
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
cpSync(path.join(pkgDir, "build", "pdf.worker.min.mjs"), path.join(outDir, "pdf.worker.min.mjs"));
cpSync(path.join(pkgDir, "standard_fonts"), path.join(outDir, "standard_fonts"), { recursive: true });
cpSync(path.join(pkgDir, "cmaps"), path.join(outDir, "cmaps"), { recursive: true });
console.log(`copied pdf.js worker + standard_fonts + cmaps -> ${path.relative(root, outDir)}`);
