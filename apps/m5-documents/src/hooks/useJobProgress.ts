import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { JobRow } from "@/integrations/supabase/types";

/**
 * Live pipeline progress for one document — initial fetch plus a Realtime
 * subscription on the `jobs` row, so the Queue/Review pages update as the
 * pipeline-worker advances through stages without polling.
 */
export function useJobProgress(documentId: string | undefined) {
  const [job, setJob] = useState<JobRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!documentId) return;
    let cancelled = false;

    setLoading(true);
    (async () => {
      try {
        const { data } = await supabase.schema("m5")
          .from("jobs")
          .select("*")
          .eq("document_id", documentId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!cancelled) setJob(data as JobRow | null);
      } catch {
        // Network/connection failure (e.g. Supabase not running locally) —
        // leave job null rather than an unhandled rejection; the page that
        // uses this hook renders its own "still processing" / not-found
        // state either way.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    const channel = supabase
      .channel(`jobs-${documentId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "m5", table: "jobs", filter: `document_id=eq.${documentId}` },
        (payload) => {
          if (!cancelled) setJob(payload.new as JobRow);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [documentId]);

  return { job, loading };
}
