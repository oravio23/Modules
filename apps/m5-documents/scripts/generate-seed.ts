/**
 * Regenerates the m5.profiles seed content from the canonical profile definitions and
 * writes it into two places:
 *
 * - supabase/seed.sql, inside the marked GENERATED M5 PROFILES section only. That file
 *   also carries a hand-authored, local-dev-only org auto-subscribe trigger outside the
 *   markers (see its own header) — this script preserves everything outside the section
 *   verbatim rather than overwriting the whole file, so regenerating profiles can never
 *   silently delete that trigger.
 * - supabase/migrations/0004_m5_seed_profiles.sql, in full, since `supabase db push`
 *   (used against a hosted/cloud project) does NOT run seed.sql — only local
 *   `supabase start`/`db reset` do. Without a migration carrying this, every extraction on
 *   a freshly-pushed cloud project would fail: extractions.profile_id has a NOT NULL
 *   foreign key into m5.profiles, which would otherwise stay empty.
 *
 * Usage: npx tsx scripts/generate-seed.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { ALL_PROFILES } from "../../../supabase/functions/_shared/profiles/index.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
// apps/m5-documents/scripts -> apps/m5-documents -> apps -> repo root
const root = path.resolve(here, "..", "..", "..");

const SECTION_START = "-- BEGIN GENERATED M5 PROFILES (do not hand-edit this section — see generate-seed.ts)";
const SECTION_END = "-- END GENERATED M5 PROFILES";

/** Postgres dollar-quoted string literal, safe against any content including embedded quotes. */
function dollarQuote(value: string, tag = "seed"): string {
  return `$${tag}$${value}$${tag}$`;
}

function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

const bodyLines: string[] = [];

for (const profile of ALL_PROFILES) {
  const schemaJson = JSON.stringify({ fields: profile.fields, repeating_group: profile.repeatingGroup });
  bodyLines.push(
    "insert into m5.profiles (id, version, status, title, description, schema, prompt, validator_ids)",
    `values (`,
    `  ${sqlLiteral(profile.id)},`,
    `  ${sqlLiteral(profile.version)},`,
    `  ${sqlLiteral(profile.status)}::m5.profile_status,`,
    `  ${sqlLiteral(profile.title)},`,
    `  ${sqlLiteral(profile.description)},`,
    `  ${dollarQuote(schemaJson)}::jsonb,`,
    `  ${dollarQuote(profile.extractionPrompt)},`,
    `  array[${profile.validatorIds.map(sqlLiteral).join(", ")}]`,
    `)`,
    "on conflict (id) do update set",
    "  version = excluded.version,",
    "  status = excluded.status,",
    "  title = excluded.title,",
    "  description = excluded.description,",
    "  schema = excluded.schema,",
    "  prompt = excluded.prompt,",
    "  validator_ids = excluded.validator_ids;",
    "",
  );
}

const body = bodyLines.join("\n").trimEnd();
const sharedHeader = [
  "-- Regenerate with: npx tsx apps/m5-documents/scripts/generate-seed.ts",
  "-- Source of truth: supabase/functions/_shared/profiles/*.ts",
  "",
].join("\n");

// ── supabase/seed.sql: replace only the marked section, preserve everything else ────────
const seedPath = path.join(root, "supabase", "seed.sql");
const existingSeed = readFileSync(seedPath, "utf8");
const startIdx = existingSeed.indexOf(SECTION_START);
const endIdx = existingSeed.indexOf(SECTION_END);

if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
  throw new Error(
    `${path.relative(root, seedPath)} is missing the "${SECTION_START}" / "${SECTION_END}" markers — ` +
      "add them once by hand (see the file's own header) so this script knows what it owns and what it doesn't.",
  );
}

const newSeed =
  existingSeed.slice(0, startIdx) +
  SECTION_START +
  "\n" +
  sharedHeader +
  body +
  "\n" +
  existingSeed.slice(endIdx);

writeFileSync(seedPath, newSeed, "utf8");
console.log(`updated the generated section of ${path.relative(root, seedPath)}`);

// ── supabase/migrations/0004_m5_seed_profiles.sql: a full migration, this one is generated ──
const migrationHeader = [
  "-- Seed data for m5.profiles.",
  "-- GENERATED FILE — do not hand-edit.",
  sharedHeader,
].join("\n");

const migrationPath = path.join(root, "supabase", "migrations", "0004_m5_seed_profiles.sql");
writeFileSync(migrationPath, migrationHeader + body + "\n", "utf8");
console.log(`wrote ${path.relative(root, migrationPath)}`);
