// Token parity check: fails loudly if tokens.css drifts from the hexes measured live off
// oravio.co/style.css. Run via `npm test` in this package (node --experimental-strip-types,
// no test runner dependency needed for a single assertion file).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ORAVIO_BRAND_TOKENS } from "./index.ts";

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
