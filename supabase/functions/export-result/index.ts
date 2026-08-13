import { createSupabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { CORS_HEADERS } from "../_shared/auth.ts";
import { requireModule } from "../_shared/entitlements.ts";
import { buildCsv } from "../_shared/csv-writer.ts";
import { buildSimpleXlsx } from "../_shared/xlsx-writer.ts";
import type { ResultEnvelope } from "../_shared/envelope-types.ts";

type ExportFormat = "json" | "csv" | "xlsx";

function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

function fieldRowsForTable(envelope: ResultEnvelope): (string | number | boolean | null)[][] {
  const header = ["field_path", "field_label", "value", "status", "requires_review", "confidence", "anchored", "blocks_export", "notes"];
  const rows: (string | number | boolean | null)[][] = [header];
  for (const field of Object.values(envelope.fields)) {
    const anchored = field.evidence.some((e) => e.anchor === "verified");
    const blocks = field.validators.some((v) => v.blocks_export);
    rows.push([
      field.field_path,
      field.field_label,
      typeof field.value === "object" && field.value !== null ? JSON.stringify(field.value) : (field.value as string | number | boolean | null),
      field.status,
      field.requires_review,
      field.confidence,
      anchored,
      blocks,
      field.notes,
    ]);
  }
  return rows;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  const gate = await requireModule(req, "m5", CORS_HEADERS);
  if ("response" in gate) return gate.response;
  const { userId } = gate;

  const url = new URL(req.url);
  const extractionId = url.searchParams.get("extractionId");
  const format = (url.searchParams.get("format") ?? "json") as ExportFormat;
  if (!extractionId) return errorResponse("extractionId query parameter required", 400);
  if (!["json", "csv", "xlsx"].includes(format)) return errorResponse(`Unsupported format "${format}"`, 400);

  const admin = createSupabaseAdmin();

  const { data: extraction, error: extractionError } = await admin
    .schema("m5")
    .from("extractions")
    .select("id, document_id, envelope, review_state, profile_id")
    .eq("id", extractionId)
    .single();
  if (extractionError || !extraction) return errorResponse("Extraction not found", 404);

  const { data: document } = await admin.schema("m5").from("documents").select("org_id, filename").eq("id", extraction.document_id).single();
  if (!document) return errorResponse("Not found", 404); // don't distinguish "not yours" from "doesn't exist"

  // requireModule() confirmed the caller has m5 access somewhere, not that this SPECIFIC
  // document belongs to one of their orgs — module access is per-user, document access is
  // per-org, and those are different checks (a user could belong to org A with m5 access
  // while this document belongs to unrelated org B).
  const { data: memberships } = await admin.schema("platform").from("org_members").select("org_id").eq("user_id", userId);
  const orgIds = new Set((memberships ?? []).map((m) => m.org_id as string));
  if (!orgIds.has(document.org_id as string)) return errorResponse("Not found", 404);

  if (extraction.review_state !== "approved") {
    return errorResponse(
      "This extraction hasn't completed human review yet. Every extraction requires explicit reviewer approval before export (pilot policy) — finish the review in the app first.",
      403,
    );
  }

  const envelope = extraction.envelope as ResultEnvelope;
  const baseFilename = (document.filename || "document").replace(/\.[^.]+$/, "");

  await admin.schema("m5").from("audit_log").insert({
    document_id: extraction.document_id,
    extraction_id: extraction.id,
    actor_id: userId,
    actor_kind: "human",
    action: "exported",
    detail: { format },
  });
  await admin.schema("m5").from("documents").update({ status: "exported" }).eq("id", extraction.document_id);

  if (format === "json") {
    return new Response(JSON.stringify(envelope, null, 2), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Content-Disposition": `attachment; filename="${baseFilename}.json"` },
    });
  }

  if (format === "csv") {
    return new Response(buildCsv(fieldRowsForTable(envelope)), {
      headers: { ...CORS_HEADERS, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${baseFilename}.csv"` },
    });
  }

  const xlsxBytes = await buildSimpleXlsx("Fields", fieldRowsForTable(envelope));
  return new Response(xlsxBytes.slice(), {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${baseFilename}.xlsx"`,
    },
  });
});
