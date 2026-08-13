/**
 * Generates supabase/seed.sql from the canonical profile definitions.
 * `supabase db reset` (and first-time `supabase start`) run this file
 * automatically after migrations, populating the `profiles` table.
 *
 * Also writes the identical content to a migration file, since `supabase db
 * push` (used against a hosted/cloud project) does NOT run seed.sql — only
 * local `supabase start`/`db reset` do. Without a migration carrying this,
 * every extraction on a freshly-pushed cloud project would fail: profile_id
 * has a NOT NULL foreign key into profiles, which would otherwise stay empty.
 *
 * Usage: npx tsx scripts/generate-seed.ts
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { ALL_PROFILES } from "../supabase/functions/_shared/profiles/index.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

/** Postgres dollar-quoted string literal, safe against any content including embedded quotes. */
function dollarQuote(value: string, tag = "seed"): string {
  return `$${tag}$${value}$${tag}$`;
}

function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

const lines: string[] = [
  "-- GENERATED FILE — do not hand-edit.",
  "-- Regenerate with: npx tsx scripts/generate-seed.ts",
  "-- Source of truth: supabase/functions/_shared/profiles/*.ts",
  "",
];

for (const profile of ALL_PROFILES) {
  const schemaJson = JSON.stringify({ fields: profile.fields, repeating_group: profile.repeatingGroup });
  lines.push(
    "insert into profiles (id, version, status, title, description, schema, prompt, validator_ids)",
    `values (`,
    `  ${sqlLiteral(profile.id)},`,
    `  ${sqlLiteral(profile.version)},`,
    `  ${sqlLiteral(profile.status)}::profile_status,`,
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

const content = lines.join("\n");

const seedPath = path.join(root, "supabase", "seed.sql");
writeFileSync(seedPath, content, "utf8");
console.log(`wrote ${path.relative(root, seedPath)}`);

const migrationPath = path.join(root, "supabase", "migrations", "0003_seed_profiles.sql");
writeFileSync(migrationPath, content, "utf8");
console.log(`wrote ${path.relative(root, migrationPath)}`);
