import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, AlertTriangle, CheckCircle2, Loader2, Clock, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { DocumentRow, DocumentStatus } from "@/integrations/supabase/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const STATUS_META: Record<DocumentStatus, { label: string; variant: "default" | "secondary" | "destructive" | "success" | "warning"; icon: typeof FileText }> = {
  uploaded: { label: "Uploaded", variant: "secondary", icon: Clock },
  queued: { label: "Queued", variant: "secondary", icon: Clock },
  processing: { label: "Processing", variant: "default", icon: Loader2 },
  pending_review: { label: "Needs review", variant: "warning", icon: AlertTriangle },
  reviewed: { label: "Reviewed", variant: "success", icon: CheckCircle2 },
  exported: { label: "Exported", variant: "success", icon: CheckCircle2 },
  failed: { label: "Failed", variant: "destructive", icon: AlertTriangle },
};

export function DocumentQueue() {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase.schema("m5").from("documents").select("*").order("created_at", { ascending: false });
        if (error) throw error;
        if (!cancelled) {
          setDocuments((data ?? []) as DocumentRow[]);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setConnectionError((err as Error).message || "Couldn't reach Supabase.");
          setLoading(false);
        }
      }
    })();

    const channel = supabase
      .channel("documents-queue")
      .on("postgres_changes", { event: "*", schema: "m5", table: "documents" }, (payload) => {
        setDocuments((prev) => {
          const row = payload.new as DocumentRow;
          if (payload.eventType === "DELETE") return prev.filter((d) => d.id !== (payload.old as DocumentRow).id);
          const exists = prev.some((d) => d.id === row.id);
          const next = exists ? prev.map((d) => (d.id === row.id ? row : d)) : [row, ...prev];
          return next.sort((a, b) => b.created_at.localeCompare(a.created_at));
        });
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (connectionError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Couldn't reach the backend</AlertTitle>
        <AlertDescription>
          {connectionError} — is Supabase running (<code>supabase start</code>) and are
          <code> VITE_SUPABASE_URL</code>/<code>VITE_SUPABASE_ANON_KEY</code> set correctly in
          <code> .env.local</code>?
        </AlertDescription>
      </Alert>
    );
  }

  if (documents.length === 0) {
    return (
      <Alert>
        <FileText className="h-4 w-4" />
        <AlertTitle>No documents yet</AlertTitle>
        <AlertDescription>Upload one from the Upload tab to see it processed here.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {documents.map((doc) => {
        const meta = STATUS_META[doc.status];
        const Icon = meta.icon;
        const clickable = doc.status === "pending_review" || doc.status === "reviewed" || doc.status === "exported";
        const content = (
          <CardContent className="flex items-center justify-between gap-4 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <FileText className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0">
                <p className="truncate font-medium">{doc.filename}</p>
                <p className="text-xs text-muted-foreground">
                  {doc.profile_id ?? "profile pending"} · {new Date(doc.created_at).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge variant={meta.variant} className="gap-1">
                <Icon className={cnAnimate(doc.status)} aria-hidden="true" />
                {meta.label}
              </Badge>
              {clickable && <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
            </div>
          </CardContent>
        );
        return (
          <Card
            key={doc.id}
            className={clickable ? "transition-colors hover:bg-accent/50 hover:border-primary/50" : "opacity-70"}
          >
            {clickable ? (
              <Link to={`/review/${doc.id}`} aria-label={`Open ${doc.filename} for review`}>
                {content}
              </Link>
            ) : (
              content
            )}
            {doc.status === "failed" && (
              <CardContent className="pt-0">
                {doc.error_reason && <p className="text-xs text-destructive">{doc.error_reason}</p>}
                <p className="text-xs text-muted-foreground">Not reviewable — re-upload the file to try again.</p>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function cnAnimate(status: DocumentStatus) {
  return status === "processing" ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5";
}
