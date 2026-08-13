import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Download, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { DocumentPartRow, DocumentRow, ExtractionRow, FieldResultRow, TranscriptRow } from "@/integrations/supabase/types";
import { useJobProgress } from "@/hooks/useJobProgress";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { FieldPanel } from "./FieldPanel";
import { KeyValuePairPanel, type ReviewUpdate } from "./KeyValuePairPanel";
import { ValidationPanel } from "./ValidationPanel";
import { PartViewer } from "./PartViewer";
import { downloadExport, type ExportFormat } from "@/lib/export/downloadExport";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ReviewWorkspaceProps {
  documentId: string;
}

interface Selection {
  partOrdinal: number;
  quote?: string;
}

export function ReviewWorkspace({ documentId }: ReviewWorkspaceProps) {
  const [document, setDocument] = useState<DocumentRow | null>(null);
  const [parts, setParts] = useState<DocumentPartRow[]>([]);
  const [transcripts, setTranscripts] = useState<TranscriptRow[]>([]);
  const [extraction, setExtraction] = useState<ExtractionRow | null>(null);
  const [fields, setFields] = useState<FieldResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection>({ partOrdinal: 1 });
  const { job } = useJobProgress(documentId);

  const load = useCallback(async () => {
    try {
      const docResult = await supabase.schema("m5").from("documents").select("*").eq("id", documentId).single();
      if (docResult.error) throw docResult.error;
      const doc = docResult.data as DocumentRow | null;

      const partsResult = await supabase.schema("m5").from("document_parts").select("*").eq("document_id", documentId).order("ordinal");
      if (partsResult.error) throw partsResult.error;
      const partRows = (partsResult.data ?? []) as DocumentPartRow[];

      const transcriptsResult = partRows.length
        ? await supabase.schema("m5").from("transcripts").select("*").in("part_id", partRows.map((p) => p.id))
        : { data: [], error: null };
      if (transcriptsResult.error) throw transcriptsResult.error;
      const transcriptRows = (transcriptsResult.data ?? []) as TranscriptRow[];

      const extResult = await supabase.schema("m5")
        .from("extractions")
        .select("*")
        .eq("document_id", documentId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (extResult.error) throw extResult.error;
      const ext = extResult.data as ExtractionRow | null;

      let fieldRows: FieldResultRow[] = [];
      if (ext) {
        const fr = await supabase.schema("m5").from("field_results").select("*").eq("extraction_id", ext.id).order("field_path");
        if (fr.error) throw fr.error;
        fieldRows = (fr.data ?? []) as FieldResultRow[];
      }

      setDocument(doc);
      setParts(partRows);
      setTranscripts(transcriptRows);
      setExtraction(ext);
      setFields(fieldRows);
      setConnectionError(null);
      setLoading(false);
    } catch (err) {
      setConnectionError((err as Error).message || "Couldn't reach Supabase.");
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const transcriptsByPartId = useMemo(() => Object.fromEntries(transcripts.map((t) => [t.part_id, t])), [transcripts]);

  const handleSelectEvidence = useCallback((partOrdinal: number, quote: string) => {
    setSelection({ partOrdinal, quote });
  }, []);

  const handleReview = useCallback(
    async (updates: ReviewUpdate[]) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      for (const { fieldId, action, humanValue } of updates) {
        const { error } = await supabase.schema("m5")
          .from("field_results")
          .update({
            human_action: action,
            human_value: action === "edited" ? humanValue : null,
            reviewed_by: user?.id ?? null,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", fieldId);

        if (error) {
          toast.error("Couldn't save review action", { description: error.message });
          return;
        }

        await supabase.schema("m5").from("audit_log").insert({
          document_id: documentId,
          extraction_id: extraction?.id ?? null,
          actor_id: user?.id ?? null,
          actor_kind: "human",
          action: `field_${action}`,
          detail: { field_id: fieldId, human_value: action === "edited" ? humanValue : undefined },
        });
      }

      await load();
    },
    [documentId, extraction?.id, load],
  );

  const handleReviewOne = useCallback(
    (fieldId: string, action: "accepted" | "edited" | "rejected", humanValue?: unknown) =>
      handleReview([{ fieldId, action, humanValue }]),
    [handleReview],
  );

  // key_values[i].label and key_values[i].value (the generic profile's open-ended repeating
  // group) always sort adjacently under ORDER BY field_path, so a single pass can pair them up
  // into one review card instead of two. Anything without an adjacent counterpart (e.g. one side
  // came back "missing") falls back to rendering standalone, same as every other field.
  const renderItems = useMemo(() => {
    const items: (
      | { kind: "field"; field: FieldResultRow }
      | { kind: "pair"; label: FieldResultRow; value: FieldResultRow }
    )[] = [];
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      const match = field.field_path.match(/^key_values\[(\d+)\]\.label$/);
      const next = fields[i + 1];
      if (match && next?.field_path === `key_values[${match[1]}].value`) {
        items.push({ kind: "pair", label: field, value: next });
        i++;
        continue;
      }
      items.push({ kind: "field", field });
    }
    return items;
  }, [fields]);

  const handleFinishReview = useCallback(async () => {
    if (!extraction) return;
    const { error } = await supabase.schema("m5").from("extractions").update({ review_state: "approved" }).eq("id", extraction.id);
    if (error) {
      toast.error("Couldn't finish review", { description: error.message });
      return;
    }
    await supabase.schema("m5").from("documents").update({ status: "reviewed" }).eq("id", documentId);
    toast.success("Review complete");
    await load();
  }, [documentId, extraction, load]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  if (connectionError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Couldn't reach the backend</AlertTitle>
        <AlertDescription>
          {connectionError} — is Supabase running (<code>supabase start</code>) and are the
          <code> VITE_SUPABASE_*</code> env vars set correctly?
        </AlertDescription>
      </Alert>
    );
  }

  if (!document) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Document not found</AlertTitle>
      </Alert>
    );
  }

  if (!extraction) {
    const pct = job && job.progress_total > 0 ? Math.round((job.progress_current / job.progress_total) * 100) : 0;
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Processing "{document.filename}"</CardTitle>
        </CardHeader>
        <div className="space-y-3 px-6 pb-6">
          <p className="text-sm text-muted-foreground">
            Stage: <span className="font-medium text-foreground">{job?.stage ?? "register"}</span> ({job?.state ?? "queued"})
          </p>
          {job && job.progress_total > 0 && <Progress value={pct} />}
          {job?.state === "failed" && (
            <Alert variant="destructive">
              <AlertTitle>Pipeline failed</AlertTitle>
              <AlertDescription>{job.last_error}</AlertDescription>
            </Alert>
          )}
          <p className="text-xs text-muted-foreground">This page updates automatically — no need to refresh.</p>
        </div>
      </Card>
    );
  }

  const allReviewed = fields.length > 0 && fields.every((f) => f.human_action !== null);
  const isApproved = extraction.review_state === "approved";

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">{document.filename}</CardTitle>
            <p className="text-xs text-muted-foreground">
              Profile: {extraction.profile_id} v{extraction.profile_version} · {document.language_hints.join(", ") || "language unknown"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isApproved ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-1">
                    <Download className="h-4 w-4" /> Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {(["json", "csv", "xlsx"] as ExportFormat[]).map((format) => (
                    <DropdownMenuItem
                      key={format}
                      onClick={() =>
                        downloadExport(extraction.id, format).catch((err) =>
                          toast.error("Export failed", { description: (err as Error).message }),
                        )
                      }
                    >
                      {format.toUpperCase()}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button className="gap-1" disabled={!allReviewed} onClick={handleFinishReview}>
                <CheckCircle2 className="h-4 w-4" /> Finish review
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-4">
          <PartViewer
            document={document}
            parts={parts}
            transcriptsByPartId={transcriptsByPartId}
            selectedOrdinal={selection.partOrdinal}
            onSelectOrdinal={(ordinal) => setSelection({ partOrdinal: ordinal })}
            highlightQuote={selection.quote}
          />
        </div>
        <div className="flex flex-col gap-3">
          <ValidationPanel summary={extraction.validation_summary} fields={fields} />
          {renderItems.map((item) =>
            item.kind === "pair" ? (
              <KeyValuePairPanel
                key={item.label.id}
                labelField={item.label}
                valueField={item.value}
                isSelected={[...item.label.evidence, ...item.value.evidence].some(
                  (e) => e.part_ordinal === selection.partOrdinal && e.quote === selection.quote,
                )}
                onSelectEvidence={handleSelectEvidence}
                onReview={handleReview}
              />
            ) : (
              <FieldPanel
                key={item.field.id}
                field={item.field}
                isSelected={item.field.evidence.some((e) => e.part_ordinal === selection.partOrdinal && e.quote === selection.quote)}
                onSelectEvidence={handleSelectEvidence}
                onReview={handleReviewOne}
              />
            ),
          )}
        </div>
      </div>
    </div>
  );
}
