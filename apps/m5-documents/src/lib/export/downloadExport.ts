import { supabase } from "@/integrations/supabase/client";

export type ExportFormat = "json" | "csv" | "xlsx";

const EXTENSION: Record<ExportFormat, string> = { json: "json", csv: "csv", xlsx: "xlsx" };

/**
 * Calls export-result directly via fetch (not supabase.functions.invoke,
 * which assumes a JSON response) so CSV/XLSX come back as real binary/text
 * rather than being force-parsed as JSON, then triggers a normal browser
 * download.
 */
export async function downloadExport(extractionId: string, format: ExportFormat): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in");

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const url = `${supabaseUrl}/functions/v1/export-result?extractionId=${encodeURIComponent(extractionId)}&format=${format}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: anonKey,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(body.error ?? `Export failed (${response.status})`);
  }

  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filenameMatch = /filename="([^"]+)"/.exec(disposition);
  const filename = filenameMatch?.[1] ?? `export.${EXTENSION[format]}`;

  const objectUrl = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(objectUrl);
}
