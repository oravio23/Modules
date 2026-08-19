import { createSupabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { pipelineAuthHeaders, requirePipelineSecret } from "../_shared/pipelineAuth.ts";
import { addUsage, computeCostUsd, emptyUsageTotals, type UsageTotals } from "../_shared/anthropic.ts";
import { transcribeBatch, type TranscribeTarget } from "../_shared/pipeline/transcribe.ts";
import { classifyDocument } from "../_shared/pipeline/classify.ts";
import { extractFields } from "../_shared/pipeline/extract.ts";
import { anchorFields } from "../_shared/validation/anchor.ts";
import { buildEnvelope } from "../_shared/envelope.ts";
import { ALL_PROFILES, PROFILES_BY_ID, expandCriticalFieldPaths, expandRequiredFieldPaths } from "../_shared/profiles/index.ts";
import { suggestDirection, containsArabic } from "../_shared/arabic.ts";
import type { PartTranscript } from "../_shared/envelope-types.ts";

const CORS_HEADERS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

// Safety margin under the free-tier 150s edge function wall-clock limit —
// leaves headroom for the final DB writes and the self-invocation network
// call. See supabase/config.toml comment on this function.
const TIME_BUDGET_MS = 100_000;
const TRANSCRIBE_BATCH_SIZE = 4;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

/**
 * Hands the rest of a long job to a fresh isolate before this one hits the wall clock.
 * Returns whether the handoff was actually accepted: fetch() resolves for a 401/500 just as
 * happily as for a 200, so a swallowed non-2xx here used to strand the job at state 'running'
 * with nothing left to advance it and no failure recorded for the UI to show.
 */
async function reinvokeSelf(jobId: string): Promise<boolean> {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/pipeline-worker`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        ...pipelineAuthHeaders(),
      },
      body: JSON.stringify({ jobId }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "<unreadable body>");
      console.error("pipeline-worker self-invoke rejected", { jobId, status: res.status, detail });
      return false;
    }
    return true;
  } catch (err) {
    console.error("pipeline-worker self-invoke failed", { jobId, err });
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  // The actual auth gate — see _shared/pipelineAuth.ts. verify_jwt=false in config.toml
  // only skips the platform gateway's JWT check (this function is never called with a
  // user session); without this, anyone with a job UUID could invoke the pipeline and
  // spend Anthropic tokens on Oravio's account.
  const authFailure = requirePipelineSecret(req, CORS_HEADERS);
  if (authFailure) return authFailure;

  const startedAt = Date.now();
  const { jobId } = (await req.json().catch(() => ({}))) as { jobId?: string };
  if (!jobId) return json({ error: "jobId required" }, 400);

  const admin = createSupabaseAdmin();
  const totalUsage: UsageTotals = emptyUsageTotals();

  const markFailed = async (documentId: string, message: string) => {
    console.error(`job ${jobId} failed:`, message);
    await admin.schema("m5").from("jobs").update({ state: "failed", last_error: message }).eq("id", jobId);
    await admin.schema("m5").from("documents").update({ status: "failed", error_reason: message }).eq("id", documentId);
    await admin.schema("m5").from("audit_log").insert({ document_id: documentId, actor_kind: "system", action: "pipeline_failed", detail: { message } });
  };

  try {
    while (true) {
      const { data: job, error: jobError } = await admin.schema("m5").from("jobs").select("*").eq("id", jobId).single();
      if (jobError || !job) return json({ error: "Job not found" }, 404);
      if (job.state === "failed" || job.stage === "done") return json({ ok: true, stage: job.stage, state: job.state });

      await admin.schema("m5").from("jobs").update({ state: "running" }).eq("id", jobId);

      const { data: document, error: documentError } = await admin.schema("m5").from("documents").select("*").eq("id", job.document_id).single();
      if (documentError || !document) return json({ error: "Document not found" }, 404);

      const { data: parts, error: partsError } = await admin.schema("m5")
        .from("document_parts")
        .select("*")
        .eq("document_id", document.id)
        .order("ordinal", { ascending: true });
      if (partsError || !parts) throw partsError ?? new Error("Failed to load document parts");

      if (job.stage === "transcribe") {
        const { data: existingTranscripts } = await admin.schema("m5")
          .from("transcripts")
          .select("part_id")
          .in("part_id", parts.map((p) => p.id));
        const transcribedPartIds = new Set((existingTranscripts ?? []).map((t) => t.part_id));
        const pending = parts.filter((p) => p.kind === "page" && !transcribedPartIds.has(p.id));

        if (pending.length === 0) {
          await admin.schema("m5").from("jobs").update({ stage: "classify" }).eq("id", jobId);
          continue;
        }

        const batch = pending.slice(0, TRANSCRIBE_BATCH_SIZE);
        const targets: TranscribeTarget[] = batch.map((p) => {
          const isPdfPage = document.detected_mime === "application/pdf";
          return {
            partId: p.id,
            ordinal: p.ordinal,
            isPdfPage,
            fileId: isPdfPage ? document.anthropic_file_id : p.anthropic_file_id,
            mime: p.mime,
          };
        });

        if (targets.some((t) => !t.fileId)) {
          throw new Error(`One or more parts in this batch have no Anthropic file_id to transcribe from (document.anthropic_file_id=${document.anthropic_file_id}).`);
        }

        const { results, usage } = await transcribeBatch(targets);
        addUsage(totalUsage, usage);

        for (const r of results) {
          const part = batch.find((p) => p.id === r.partId)!;
          await admin.schema("m5").from("transcripts").insert({
            part_id: r.partId,
            text: r.text,
            text_layer: part.pending_text_layer,
            direction: suggestDirection(r.text),
            languages: containsArabic(r.text) ? ["ar"] : ["en"],
          });
        }

        await admin.schema("m5").from("jobs").update({ progress_current: (job.progress_current ?? 0) + results.length }).eq("id", jobId);

        if (Date.now() - startedAt > TIME_BUDGET_MS && pending.length > batch.length) {
          // If nothing picked up the baton, fail the job here rather than reporting ok:true
          // and leaving it 'running' forever — there is no reaper to clean that up, and
          // useJobProgress has no timeout, so the user's page would spin indefinitely.
          if (!(await reinvokeSelf(jobId))) {
            await markFailed(job.document_id, "Pipeline handoff failed — could not continue transcription.");
            return json({ ok: false, stage: "transcribe", state: "failed", reason: "handoff_failed" }, 500);
          }
          return json({ ok: true, stage: "transcribe", state: "continuing", remaining: pending.length - batch.length });
        }
        continue;
      }

      if (job.stage === "classify") {
        const { data: transcripts } = await admin.schema("m5")
          .from("transcripts")
          .select("part_id, text")
          .in("part_id", parts.map((p) => p.id));
        const excerpt = (transcripts ?? []).map((t) => t.text).join("\n\n").slice(0, 8000);

        const result = await classifyDocument(excerpt, ALL_PROFILES);
        addUsage(totalUsage, result.usage);

        await admin.schema("m5")
          .from("documents")
          .update({ profile_id: result.profileId, profile_confidence: result.confidence })
          .eq("id", document.id);
        await admin.schema("m5").from("jobs").update({ stage: "extract" }).eq("id", jobId);
        continue;
      }

      if (job.stage === "extract") {
        const { data: freshDoc } = await admin.schema("m5").from("documents").select("profile_id, profile_confidence").eq("id", document.id).single();
        const profile = PROFILES_BY_ID[freshDoc?.profile_id ?? "generic"];
        if (!profile) throw new Error(`Unknown profile_id "${freshDoc?.profile_id}"`);

        const { data: transcriptRows } = await admin.schema("m5")
          .from("transcripts")
          .select("part_id, text, direction")
          .in("part_id", parts.map((p) => p.id));

        const partById = new Map(parts.map((p) => [p.id, p]));
        const partTranscripts: PartTranscript[] = (transcriptRows ?? []).map((t) => ({
          part_ordinal: partById.get(t.part_id)!.ordinal,
          text: t.text,
          direction: t.direction,
        }));
        const transcriptText = partTranscripts
          .sort((a, b) => a.part_ordinal - b.part_ordinal)
          .map((t) => `[Part ${t.part_ordinal}]\n${t.text}`)
          .join("\n\n");

        const { fields: draftFields, usage } = await extractFields(profile, transcriptText);
        addUsage(totalUsage, usage);

        // Anchor + validate happen instantly and locally (no model call) —
        // folded into this same stage-slice rather than separate DB-tracked
        // stages, since there's nothing to gain from splitting deterministic,
        // sub-second work across invocations. See ADR-013.
        const anchored = anchorFields(draftFields, partTranscripts);
        const rowCount = Math.max(
          0,
          ...Object.keys(draftFields)
            .map((k) => /^line_items\[(\d+)\]\./.exec(k)?.[1])
            .filter((x): x is string => Boolean(x))
            .map((x) => Number(x) + 1),
          0,
        );

        const runUsageWithCost = { ...totalUsage, estimated_cost_usd: computeCostUsd(totalUsage) };
        const { envelope, fieldRows } = buildEnvelope({
          documentId: document.id,
          sha256: document.sha256,
          detectedMime: document.detected_mime,
          partCount: parts.length,
          languages: document.language_hints ?? [],
          profileId: profile.id,
          profileVersion: profile.version,
          profileStatus: profile.status,
          profileConfidence: freshDoc?.profile_confidence ?? null,
          anchoredFields: anchored,
          requiredFieldPaths: expandRequiredFieldPaths(profile, rowCount),
          criticalFieldPaths: expandCriticalFieldPaths(profile, rowCount),
          validatorIds: profile.validatorIds,
          usage: runUsageWithCost,
        });

        const { data: extraction, error: extractionError } = await admin.schema("m5")
          .from("extractions")
          .insert({
            document_id: document.id,
            profile_id: profile.id,
            profile_version: profile.version,
            envelope,
            usage_json: runUsageWithCost,
            validation_summary: envelope.validation.summary,
            review_state: "pending",
          })
          .select("id")
          .single();
        if (extractionError || !extraction) throw extractionError ?? new Error("Failed to insert extraction");

        await admin.schema("m5").from("field_results").insert(
          fieldRows.map((f) => ({
            extraction_id: extraction.id,
            field_path: f.field_path,
            field_label: f.field_label,
            value: f.value,
            status: f.status,
            requires_review: f.requires_review,
            confidence: f.confidence,
            evidence: f.evidence,
            validator_results: f.validators,
            notes: f.notes,
          })),
        );

        await admin.schema("m5").from("jobs").update({ stage: "done", state: "succeeded" }).eq("id", jobId);
        await admin.schema("m5").from("documents").update({ status: "pending_review" }).eq("id", document.id);
        await admin.schema("m5").from("audit_log").insert({
          document_id: document.id,
          extraction_id: extraction.id,
          actor_kind: "system",
          action: "extraction_completed",
          detail: { profile_id: profile.id, blocks_export: envelope.validation.summary.blocks_export },
        });
        continue;
      }

      // Unknown/unhandled stage — treat as done rather than looping forever.
      await admin.schema("m5").from("jobs").update({ stage: "done", state: "succeeded" }).eq("id", jobId);
      continue;
    }
  } catch (err) {
    const { data: job } = await admin.schema("m5").from("jobs").select("document_id").eq("id", jobId).single();
    if (job) await markFailed(job.document_id, (err as Error).message);
    return json({ error: (err as Error).message }, 500);
  }
});
