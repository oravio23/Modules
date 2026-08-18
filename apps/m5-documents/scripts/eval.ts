/**
 * Eval harness — runs classification + extraction + anchoring + validation
 * against the synthetic invoice fixtures and reports field-level accuracy,
 * anchor rate, validator outcome distribution, and cost. Requires a real
 * ANTHROPIC_API_KEY in the environment (reads process.env directly; this is
 * a local dev script, never the browser — see anthropic.ts's getEnvVar).
 *
 * Deliberately skips the transcribe stage: fixtures/invoices/*\/transcript.txt
 * is used directly as "already transcribed" input, so this measures
 * classify+extract+anchor+validate accuracy, not OCR/vision transcription
 * quality (there is no ground-truth OCR fixture to compare against — see
 * fixtures/invoices/arabic-mixed/golden.json's note on why there's no real
 * scanned/photographed fixture in this repo).
 *
 * Per Charter §5: this reports numbers only. It asserts NO pass/fail
 * threshold — numeric acceptance targets are deferred to the Phase 4/8
 * baseline benchmark and must not be invented here.
 *
 * Usage: ANTHROPIC_API_KEY=sk-ant-... npx tsx scripts/eval.ts
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { classifyDocument } from "../../../supabase/functions/_shared/pipeline/classify.ts";
import { extractFields } from "../../../supabase/functions/_shared/pipeline/extract.ts";
import { anchorFields, hasVerifiedEvidence } from "../../../supabase/functions/_shared/validation/anchor.ts";
import { buildEnvelope } from "../../../supabase/functions/_shared/envelope.ts";
import { ALL_PROFILES, PROFILES_BY_ID, expandCriticalFieldPaths, expandRequiredFieldPaths } from "../../../supabase/functions/_shared/profiles/index.ts";
import { addUsage, computeCostUsd, emptyUsageTotals } from "../../../supabase/functions/_shared/anthropic.ts";
import type { PartTranscript } from "../../../supabase/functions/_shared/envelope-types.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const invoicesDir = path.join(root, "fixtures", "invoices");

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set. Usage: ANTHROPIC_API_KEY=sk-ant-... npx tsx scripts/eval.ts");
  process.exit(1);
}

interface ScenarioResult {
  scenarioId: string;
  expectedProfileId: string;
  actualProfileId: string;
  profileCorrect: boolean;
  fieldsCompared: number;
  fieldsCorrect: number;
  fieldsAnchored: number;
  fieldsExtracted: number;
  validatorOutcomes: Record<string, number>;
  costUsd: number;
}

function loadGolden(scenarioId: string): { transcript: string; golden: Record<string, unknown> } {
  const dir = path.join(invoicesDir, scenarioId);
  const transcript = readFileSync(path.join(dir, "transcript.txt"), "utf8");
  const golden = JSON.parse(readFileSync(path.join(dir, "golden.json"), "utf8"));
  return { transcript, golden };
}

function valuesRoughlyEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) return a == b;
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) < 0.01;
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

async function runScenario(scenarioId: string): Promise<ScenarioResult> {
  const { transcript, golden } = loadGolden(scenarioId);
  const expectedProfileId = (golden.profile_id as string) ?? "commercial_invoice";

  const classifyResult = await classifyDocument(transcript, ALL_PROFILES);
  const profile = PROFILES_BY_ID[classifyResult.profileId] ?? PROFILES_BY_ID["generic"];

  const usage = emptyUsageTotals();
  addUsage(usage, classifyResult.usage);

  if (!golden.expected_field_values) {
    // generic-profile scenarios (e.g. delivery-note) don't have a fixed
    // field set to score against — report classification only.
    return {
      scenarioId,
      expectedProfileId,
      actualProfileId: classifyResult.profileId,
      profileCorrect: classifyResult.profileId === expectedProfileId,
      fieldsCompared: 0,
      fieldsCorrect: 0,
      fieldsAnchored: 0,
      fieldsExtracted: 0,
      validatorOutcomes: {},
      costUsd: computeCostUsd(usage),
    };
  }

  const partTranscripts: PartTranscript[] = [{ part_ordinal: 1, text: transcript, direction: "auto" }];
  const { fields: draftFields, usage: extractUsage } = await extractFields(profile, `[Part 1]\n${transcript}`);
  addUsage(usage, extractUsage);

  const anchored = anchorFields(draftFields, partTranscripts);
  const rowCount = Math.max(
    0,
    ...Object.keys(draftFields)
      .map((k) => /^line_items\[(\d+)\]\./.exec(k)?.[1])
      .filter((x): x is string => Boolean(x))
      .map((x) => Number(x) + 1),
    0,
  );

  const { envelope } = buildEnvelope({
    documentId: `eval-${scenarioId}`,
    sha256: "0".repeat(64),
    detectedMime: "text/plain",
    partCount: 1,
    languages: [],
    profileId: profile.id,
    profileVersion: profile.version,
    profileStatus: profile.status,
    profileConfidence: classifyResult.confidence,
    anchoredFields: anchored,
    requiredFieldPaths: expandRequiredFieldPaths(profile, rowCount),
    criticalFieldPaths: expandCriticalFieldPaths(profile, rowCount),
    validatorIds: profile.validatorIds,
    usage: { ...usage, estimated_cost_usd: computeCostUsd(usage) },
  });

  const expected = golden.expected_field_values as Record<string, unknown>;
  let fieldsCompared = 0;
  let fieldsCorrect = 0;
  let fieldsAnchored = 0;
  let fieldsExtracted = 0;
  const validatorOutcomes: Record<string, number> = {};

  for (const [path_, expectedValue] of Object.entries(expected)) {
    fieldsCompared++;
    const actual = envelope.fields[path_];
    if (!actual) continue;
    if (actual.status === "extracted") {
      fieldsExtracted++;
      if (hasVerifiedEvidence({ evidence: actual.evidence })) fieldsAnchored++;
      if (valuesRoughlyEqual(actual.value, expectedValue)) fieldsCorrect++;
    } else if (expectedValue === null && (actual.status === "missing" || actual.status === "not_applicable")) {
      fieldsCorrect++; // honestly missing, as expected
    }
  }

  for (const result of envelope.validation.results) {
    validatorOutcomes[result.outcome] = (validatorOutcomes[result.outcome] ?? 0) + 1;
  }

  return {
    scenarioId,
    expectedProfileId,
    actualProfileId: classifyResult.profileId,
    profileCorrect: classifyResult.profileId === expectedProfileId,
    fieldsCompared,
    fieldsCorrect,
    fieldsAnchored,
    fieldsExtracted,
    validatorOutcomes,
    costUsd: computeCostUsd(usage),
  };
}

async function main() {
  const scenarioIds = readdirSync(invoicesDir).filter((name) => name !== "arabic-mixed" || process.env.EVAL_INCLUDE_ARABIC === "1");
  if (!scenarioIds.includes("arabic-mixed") && process.env.EVAL_INCLUDE_ARABIC !== "1") {
    console.log("(skipping arabic-mixed by default — set EVAL_INCLUDE_ARABIC=1 to include it; it's a real API call same as the rest)");
  }

  const results: ScenarioResult[] = [];
  for (const id of scenarioIds) {
    console.log(`Running ${id}...`);
    try {
      results.push(await runScenario(id));
    } catch (err) {
      console.error(`  FAILED: ${(err as Error).message}`);
    }
  }

  console.log("\n=== Per-scenario results ===");
  for (const r of results) {
    const precision = r.fieldsExtracted > 0 ? (r.fieldsCorrect / r.fieldsExtracted) * 100 : null;
    const recall = r.fieldsCompared > 0 ? (r.fieldsCorrect / r.fieldsCompared) * 100 : null;
    const anchorRate = r.fieldsExtracted > 0 ? (r.fieldsAnchored / r.fieldsExtracted) * 100 : null;
    console.log(
      `- ${r.scenarioId}: profile=${r.actualProfileId} (expected ${r.expectedProfileId}, ${r.profileCorrect ? "OK" : "MISMATCH"})` +
        (r.fieldsCompared > 0
          ? ` | fields ${r.fieldsCorrect}/${r.fieldsCompared} correct` +
            ` | precision=${precision?.toFixed(0)}% recall=${recall?.toFixed(0)}%` +
            ` | anchor-rate=${anchorRate?.toFixed(0)}%` +
            ` | validators=${JSON.stringify(r.validatorOutcomes)}`
          : "") +
        ` | cost=$${r.costUsd.toFixed(4)}`,
    );
  }

  const totalCost = results.reduce((a, r) => a + r.costUsd, 0);
  const scored = results.filter((r) => r.fieldsCompared > 0);
  const totalCorrect = scored.reduce((a, r) => a + r.fieldsCorrect, 0);
  const totalCompared = scored.reduce((a, r) => a + r.fieldsCompared, 0);
  const totalExtracted = scored.reduce((a, r) => a + r.fieldsExtracted, 0);
  const totalAnchored = scored.reduce((a, r) => a + r.fieldsAnchored, 0);

  console.log("\n=== Aggregate (report only — no pass/fail threshold; see Charter §5) ===");
  console.log(`Scenarios run: ${results.length}`);
  console.log(`Profile classification correct: ${results.filter((r) => r.profileCorrect).length}/${results.length}`);
  if (totalCompared > 0) {
    console.log(`Field recall: ${totalCorrect}/${totalCompared} (${((totalCorrect / totalCompared) * 100).toFixed(1)}%)`);
  }
  if (totalExtracted > 0) {
    console.log(`Field precision (of extracted): ${totalCorrect}/${totalExtracted} (${((totalCorrect / totalExtracted) * 100).toFixed(1)}%)`);
    console.log(`Evidence anchor rate: ${totalAnchored}/${totalExtracted} (${((totalAnchored / totalExtracted) * 100).toFixed(1)}%)`);
  }
  console.log(`Total cost: $${totalCost.toFixed(4)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
