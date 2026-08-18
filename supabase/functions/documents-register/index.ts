import { createSupabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { uploadFileToAnthropic } from "../_shared/anthropic.ts";
import { decideInitialStage } from "../_shared/pipeline/stages.ts";
import { CORS_HEADERS } from "../_shared/auth.ts";
import { requireModule } from "../_shared/entitlements.ts";
import { isOrgScopedPath } from "../_shared/storage-paths.ts";
import { pipelineAuthHeaders } from "../_shared/pipelineAuth.ts";
import { waitUntil } from "../_shared/edgeRuntime.ts";
import type { RegisterDocumentRequest, RegisterDocumentResponse, RegisterErrorResponse } from "../_shared/contracts/register.ts";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" } satisfies RegisterErrorResponse, 405);

  // Top-level safety net: every other error path in this function already logs and returns
  // a clean JSON response, but an exception thrown outside those (e.g. from the Anthropic
  // SDK, or a Supabase client constructor call) would otherwise surface as a bare "non-2xx
  // status code" client-side with nothing in the function logs to diagnose it by — this
  // guarantees both a real error message and a stack trace end up in the logs.
  try {
    return await handleRegister(req);
  } catch (err) {
    console.error("documents-register: unhandled exception", err instanceof Error ? err.stack ?? err.message : String(err));
    return json({ error: "Internal error", reason: err instanceof Error ? err.message : String(err) } satisfies RegisterErrorResponse, 500);
  }
});

async function handleRegister(req: Request): Promise<Response> {
  const gate = await requireModule(req, "m5", CORS_HEADERS);
  if ("response" in gate) return gate.response;
  const { userId } = gate;

  let body: RegisterDocumentRequest;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" } satisfies RegisterErrorResponse, 400);
  }

  if (!body.storagePath || !body.sha256 || !Array.isArray(body.parts) || body.parts.length === 0) {
    return json({ error: "Missing required fields (storagePath, sha256, parts)" } satisfies RegisterErrorResponse, 400);
  }

  const admin = createSupabaseAdmin();

  // requireModule() already confirmed module access; resolving the caller's org separately
  // here because a module grant is per-user, not per-org — this pilot assumes single-org
  // membership, same as src/lib/org.ts's client-side equivalent (which built the storage
  // path this row's storage_path must belong to).
  const { data: membership, error: orgError } = await admin
    .schema("platform")
    .from("org_members")
    .select("org_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (orgError || !membership) {
    return json({ error: "Not a member of any organization" } satisfies RegisterErrorResponse, 403);
  }
  const orgId = membership.org_id as string;

  // Re-validate every client-supplied Storage key against the org just resolved. The bucket
  // policy that constrained the browser's own upload does NOT apply to the service_role
  // reads further down (admin.storage.download of the original and of each binary part) —
  // service_role bypasses RLS. Without this, a user entitled to m5 could post another org's
  // key and have the server fetch that file and ship it to the Anthropic Files API. See
  // _shared/storage-paths.ts.
  // Only an absent path is skipped (a part with no independent binary content legitimately
  // has none) — everything actually supplied is validated, including values that aren't
  // strings. findIndex's -1 is used rather than find()'s undefined because an offending
  // value can itself be falsy, which a truthiness check would wave through.
  const suppliedPaths: unknown[] = [body.storagePath, ...body.parts.map((p) => p.storagePath)]
    .filter((p) => p !== undefined && p !== null);
  const foreignIndex = suppliedPaths.findIndex((p) => !isOrgScopedPath(p, orgId));
  if (foreignIndex !== -1) {
    // JSON.stringify, not interpolation: the path is attacker-controlled and this is the
    // log line someone reads when investigating cross-tenant access, so an embedded newline
    // must not be able to forge an additional record.
    console.error(
      `documents-register: rejected out-of-org storage path (user=${userId} org=${orgId} path=${JSON.stringify(suppliedPaths[foreignIndex])})`,
    );
    return json(
      { error: "Storage path is not within your organization's folder" } satisfies RegisterErrorResponse,
      403,
    );
  }

  // 1. Create the document row.
  const languages = new Set<string>();
  for (const p of body.parts) {
    const sample = p.text ?? p.textLayer ?? "";
    if (/[؀-ۿ]/.test(sample)) languages.add("ar");
    if (/[A-Za-z]/.test(sample)) languages.add("en");
  }

  const { data: doc, error: docError } = await admin
    .schema("m5")
    .from("documents")
    .insert({
      owner_id: userId,
      org_id: orgId,
      filename: body.filename,
      declared_mime: body.declaredMime ?? null,
      detected_mime: body.detectedMime,
      sha256: body.sha256,
      byte_size: body.byteSize,
      storage_path: body.storagePath,
      language_hints: [...languages],
      status: "uploaded",
    })
    .select("id")
    .single();

  if (docError || !doc) {
    console.error("documents insert failed", docError);
    return json({ error: "Failed to register document", reason: docError?.message } satisfies RegisterErrorResponse, 500);
  }
  const documentId = doc.id as string;

  // 2. Whole-file Files API upload for PDFs — every page references this one file_id downstream.
  if (body.detectedMime === "application/pdf") {
    try {
      const { data: fileBlob, error: dlError } = await admin.storage.from("documents").download(body.storagePath);
      if (dlError || !fileBlob) throw dlError ?? new Error("download returned no data");
      const bytes = new Uint8Array(await fileBlob.arrayBuffer());
      const fileId = await uploadFileToAnthropic(bytes, body.filename, "application/pdf");
      await admin.schema("m5").from("documents").update({ anthropic_file_id: fileId }).eq("id", documentId);
    } catch (err) {
      console.error("Anthropic PDF upload failed", err);
      await admin.schema("m5").from("documents").update({ status: "failed", error_reason: `PDF upload to Anthropic failed: ${(err as Error).message}` }).eq("id", documentId);
      return json({ error: "Failed to upload PDF to Anthropic", reason: (err as Error).message } satisfies RegisterErrorResponse, 502);
    }
  }

  // 3. Insert document_parts + per-part Anthropic upload for standalone binary parts (images).
  const partRows = body.parts.map((p) => ({
    document_id: documentId,
    ordinal: p.ordinal,
    kind: p.kind,
    label: p.label,
    storage_path: p.storagePath ?? null,
    mime: p.mime ?? null,
    width: p.width ?? null,
    height: p.height ?? null,
    pending_text_layer: p.kind === "page" ? (p.textLayer ?? null) : null,
  }));
  const { data: insertedParts, error: partsError } = await admin
    .schema("m5")
    .from("document_parts")
    .insert(partRows)
    .select("id, ordinal, kind, storage_path, mime");

  if (partsError || !insertedParts) {
    console.error("document_parts insert failed", partsError);
    await admin.schema("m5").from("documents").update({ status: "failed", error_reason: `Part registration failed: ${partsError?.message}` }).eq("id", documentId);
    return json({ error: "Failed to register document parts", reason: partsError?.message } satisfies RegisterErrorResponse, 500);
  }

  for (const row of insertedParts) {
    if (!row.storage_path) continue; // no independent binary content to upload (text-based part, or a PDF page)
    try {
      const { data: blob, error: dlError } = await admin.storage.from("documents").download(row.storage_path);
      if (dlError || !blob) throw dlError ?? new Error("download returned no data");
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const fileId = await uploadFileToAnthropic(bytes, `part-${row.ordinal}`, row.mime ?? "application/octet-stream");
      await admin.schema("m5").from("document_parts").update({ anthropic_file_id: fileId }).eq("id", row.id);
    } catch (err) {
      console.error(`Anthropic upload failed for part ${row.ordinal}`, err);
      // Non-fatal for the whole document — this one part will surface as
      // unable-to-transcribe later rather than blocking every other part.
    }
  }

  // 4. Insert transcripts for parts that already carry an authoritative transcript (sheet/slide/text kinds).
  const transcriptRows = body.parts
    .filter((p) => p.kind !== "page" && p.text)
    .map((p) => {
      const isArabic = /[؀-ۿ]/.test(p.text!);
      return {
        part_id: insertedParts.find((row) => row.ordinal === p.ordinal)!.id,
        text: p.text!,
        text_layer: null,
        direction: p.direction ?? (isArabic ? "rtl" : "ltr"),
        languages: isArabic ? ["ar"] : ["en"],
      };
    });
  if (transcriptRows.length > 0) {
    const { error: transcriptError } = await admin.schema("m5").from("transcripts").insert(transcriptRows);
    if (transcriptError) {
      console.error("transcripts insert failed", transcriptError);
    }
  }

  // 5. Create the job at whichever stage the document actually needs.
  const initialStage = decideInitialStage(body.parts.map((p) => ({ kind: p.kind })));
  const { data: job, error: jobError } = await admin
    .schema("m5")
    .from("jobs")
    .insert({ document_id: documentId, stage: initialStage, state: "queued", progress_total: body.parts.length })
    .select("id")
    .single();

  if (jobError || !job) {
    console.error("jobs insert failed", jobError);
    return json({ error: "Failed to create pipeline job", reason: jobError?.message } satisfies RegisterErrorResponse, 500);
  }

  await admin.schema("m5").from("documents").update({ status: "queued" }).eq("id", documentId);
  await admin.schema("m5").from("audit_log").insert({
    document_id: documentId,
    actor_id: userId,
    actor_kind: "human",
    action: "document_uploaded",
    detail: { filename: body.filename, detected_mime: body.detectedMime, part_count: body.parts.length, warnings: body.warnings },
  });

  // 6. Kick off the pipeline worker. Fire-and-forget: the browser gets an
  // immediate response and follows progress via Realtime on the jobs row,
  // it does not wait on the (potentially many-stage) pipeline run.
  //
  // Wrapped in EdgeRuntime.waitUntil(): under config.toml's `policy = "oneshot"`, the edge
  // runtime can tear down this invocation's isolate as soon as the response below is sent,
  // which can cancel an in-flight, un-awaited fetch() before it ever reaches pipeline-worker
  // — the document would then sit at status 'queued' forever with nothing to retry it. This
  // is documented in docs/hub-v1-contract-audit.md §11 item 6. waitUntil() keeps the
  // isolate alive until the promise settles, without making the CALLER (the browser) wait
  // for it — the response above is already on its way back.
  const workerUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/pipeline-worker`;
  const invokeWorker = fetch(workerUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      ...pipelineAuthHeaders(),
    },
    body: JSON.stringify({ jobId: job.id }),
  }).catch((err) => console.error("Failed to invoke pipeline-worker", err));
  waitUntil(invokeWorker);

  return json({
    documentId,
    jobId: job.id as string,
    initialStage,
    partCount: body.parts.length,
  } satisfies RegisterDocumentResponse);
}
