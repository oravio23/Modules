// Registry parity check: fails loudly if modules.ts drifts from what the migrations
// actually seed. Plain .mjs, no TypeScript — same reasoning as
// packages/tokens/src/__parity__.test.mjs: this needs to run on whatever Node version CI
// and colleagues' machines happen to have, without --experimental-strip-types.
//
// modules.ts's own header says the migration wins on drift — this is that check made
// automatic instead of relying on someone noticing. It parses supabase/migrations/0001's
// base insert, then replays every later migration matching one of the two update shapes
// 0005/0009 (`update platform.modules set status = '<status>' where id = '<id>'`) and 0006
// (`update platform.modules set route = route || '/' where route not like '%/'`) actually
// use — so a new "flip m4 live" migration is picked up the same way without editing this
// file.
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const migrationsDir = path.join(root, "supabase", "migrations");
const modulesPath = path.join(root, "packages", "entitlements", "src", "lib", "entitlements", "modules.ts");

const migrationFiles = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const baseFile = migrationFiles.find((f) => f.includes("platform_core"));
if (!baseFile) {
  console.error("Could not find the platform_core migration (expected e.g. 0001_platform_core.sql).");
  process.exit(1);
}
const baseSql = readFileSync(path.join(migrationsDir, baseFile), "utf8");

const rowPattern =
  /\(\s*'(m\d)',\s*'([^']*)',\s*'([^']*)',\s*'((?:[^'\\]|\\.)*)',\s*array\[([^\]]*)\],\s*'(\w+)',\s*'([^']*)',\s*(\d+)\s*\)/g;

const expected = new Map();
for (const match of baseSql.matchAll(rowPattern)) {
  const [, id, slug, name, tagline, personasRaw, status, route, sortOrder] = match;
  const personas = [...personasRaw.matchAll(/'([^']*)'/g)].map((m) => m[1]);
  expected.set(id, { id, slug, name, tagline, personas, status, route, sortOrder: Number(sortOrder) });
}

if (expected.size !== 6) {
  console.error(`Expected 6 modules parsed out of ${baseFile}, got ${expected.size}. Regex is out of sync with the migration's SQL shape.`);
  process.exit(1);
}

for (const file of migrationFiles) {
  if (file === baseFile) continue;
  const sql = readFileSync(path.join(migrationsDir, file), "utf8");

  for (const m of sql.matchAll(/update\s+platform\.modules\s+set\s+status\s*=\s*'(\w+)'\s+where\s+id\s*=\s*'(m\d)'/gi)) {
    const [, status, id] = m;
    const row = expected.get(id);
    if (row) row.status = status;
  }

  if (/update\s+platform\.modules\s+set\s+route\s*=\s*route\s*\|\|\s*'\/'\s+where\s+route\s+not\s+like\s+'%\/'/i.test(sql)) {
    for (const row of expected.values()) {
      if (!row.route.endsWith("/")) row.route += "/";
    }
  }
}

const ts = readFileSync(modulesPath, "utf8");
const tsRowPattern =
  /id:\s*"(m\d)",\s*slug:\s*"([^"]*)",\s*name:\s*"([^"]*)",\s*tagline:\s*"((?:[^"\\]|\\.)*)",\s*personas:\s*\[([^\]]*)\],\s*status:\s*"(\w+)",\s*route:\s*"([^"]*)",\s*sortOrder:\s*(\d+),/g;

const actual = new Map();
for (const match of ts.matchAll(tsRowPattern)) {
  const [, id, slug, name, tagline, personasRaw, status, route, sortOrder] = match;
  const personas = [...personasRaw.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
  actual.set(id, { id, slug, name, tagline, personas, status, route, sortOrder: Number(sortOrder) });
}

if (actual.size !== 6) {
  console.error(`Expected 6 modules parsed out of modules.ts, got ${actual.size}. Regex is out of sync with MODULES' shape.`);
  process.exit(1);
}

let failures = 0;
for (const [id, want] of expected) {
  const got = actual.get(id);
  if (!got) {
    console.error(`MISSING ${id} in modules.ts`);
    failures++;
    continue;
  }
  for (const key of ["slug", "name", "tagline", "status", "route", "sortOrder"]) {
    if (String(want[key]) !== String(got[key])) {
      console.error(`MISMATCH ${id}.${key}: modules.ts has ${JSON.stringify(got[key])}, migrations say ${JSON.stringify(want[key])}`);
      failures++;
    }
  }
  if (JSON.stringify(want.personas) !== JSON.stringify(got.personas)) {
    console.error(`MISMATCH ${id}.personas: modules.ts has ${JSON.stringify(got.personas)}, migrations say ${JSON.stringify(want.personas)}`);
    failures++;
  }
}

if (failures > 0) {
  console.error(`\n${failures} field(s) drifted from the migrations. modules.ts's own header says the migration wins — update modules.ts to match, or add the missing migration if the DB is actually wrong.`);
  process.exit(1);
}

console.log("modules.ts matches the seeded + updated platform.modules rows.");
