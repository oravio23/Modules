// Token parity check: fails loudly if tokens.css drifts from the hexes measured live off
// oravio.co/style.css. Plain .mjs, no TypeScript/type-stripping — CI runners and colleagues'
// machines won't all be on a Node version new enough for --experimental-strip-types, and this
// file has no reason to depend on that. Keep this list in sync with ORAVIO_BRAND_TOKENS in
// index.ts by hand; both independently diff against tokens.css, which is the actual guard.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ORAVIO_BRAND_TOKENS = {
  ink: "#121938",
  muted: "#626b7d",
  line: "#dce2ea",
  paper: "#f7f9fb",
  panel: "#fff",
  field: "#edf5f4",
  teal: "#087c75",
  "teal-dark": "#045f5b",
  navy: "#111832",
  "navy-soft": "#1c2648",
  amber: "#b97823",
  blue: "#2f6f9e",
};

const cssPath = fileURLToPath(new URL("./tokens.css", import.meta.url));
const css = readFileSync(cssPath, "utf8");

let failures = 0;

for (const [name, expected] of Object.entries(ORAVIO_BRAND_TOKENS)) {
  const match = css.match(new RegExp(`--${name}:\\s*([^;]+);`));
  const actual = match?.[1]?.trim().toLowerCase();
  const expectedNorm = expected.toLowerCase();
  if (actual !== expectedNorm) {
    failures++;
    console.error(`MISMATCH --${name}: tokens.css has "${actual ?? "(missing)"}", expected "${expectedNorm}"`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} brand token(s) drifted from oravio.co. Fix tokens.css or update ORAVIO_BRAND_TOKENS in index.ts if oravio.co itself changed.`);
  process.exit(1);
}

console.log(`Token parity OK: all ${Object.keys(ORAVIO_BRAND_TOKENS).length} brand tokens match oravio.co.`);
