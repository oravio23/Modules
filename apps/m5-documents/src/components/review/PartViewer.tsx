import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { DocumentPartRow, DocumentRow, TranscriptRow } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { normalizeForMatch } from "@/lib/arabic";

interface PartViewerProps {
  document: DocumentRow;
  parts: DocumentPartRow[];
  transcriptsByPartId: Record<string, TranscriptRow>;
  selectedOrdinal: number;
  onSelectOrdinal: (ordinal: number) => void;
  /** The evidence quote to highlight in the transcript pane, if any field is focused. */
  highlightQuote?: string;
}

/** Render `text` with every case/diacritic/numeral-insensitive occurrence of `quote` wrapped in <mark>. */
function renderHighlighted(text: string, quote: string | undefined) {
  if (!quote || quote.trim().length === 0) return text;
  const normalizedText = normalizeForMatch(text);
  const normalizedQuote = normalizeForMatch(quote);
  const idx = normalizedQuote.length > 0 ? normalizedText.indexOf(normalizedQuote) : -1;
  // Normalisation can change string length (digit folding, diacritic
  // stripping), so we can't map the normalised index back to the raw text
  // precisely — fall back to a raw-text search for the highlight itself,
  // which covers the common case (the anchor already succeeded via one of
  // these two paths; see validation/anchor.ts).
  const rawIdx = text.indexOf(quote);
  if (rawIdx !== -1) {
    return (
      <>
        {text.slice(0, rawIdx)}
        <mark className="rounded bg-warning/40 px-0.5">{text.slice(rawIdx, rawIdx + quote.length)}</mark>
        {text.slice(rawIdx + quote.length)}
      </>
    );
  }
  if (idx !== -1) {
    // Found only via normalised match — cannot slice exact original
    // characters, so flag the whole transcript as "contains a fuzzy match"
    // rather than mis-highlighting.
    return (
      <>
        <span className="mb-1 block text-xs italic text-muted-foreground">
          (matched after normalising numerals/diacritics — exact position not shown)
        </span>
        {text}
      </>
    );
  }
  return text;
}

function PdfPageCanvas({ storagePath, ordinal }: { storagePath: string; ordinal: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask: { cancel: () => void } | null = null;

    (async () => {
      try {
        const { data, error: dlError } = await supabase.storage.from("documents").download(storagePath);
        if (dlError || !data) throw dlError ?? new Error("download failed");
        const bytes = new Uint8Array(await data.arrayBuffer());

        const { ensurePdfJsConfigured, PDF_CMAPS_URL, PDF_STANDARD_FONT_DATA_URL } = await import("@/lib/pdf/pdfjs-setup");
        const pdfjsLib = ensurePdfJsConfigured();
        const doc = await pdfjsLib.getDocument({
          data: bytes,
          standardFontDataUrl: PDF_STANDARD_FONT_DATA_URL,
          cMapUrl: PDF_CMAPS_URL,
          cMapPacked: true,
        }).promise;
        if (cancelled) return;
        const page = await doc.getPage(ordinal);
        const viewport = page.getViewport({ scale: 1.4 });
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const task = page.render({ canvasContext: ctx, viewport });
        renderTask = task;
        await task.promise;
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [storagePath, ordinal]);

  if (error) return <p className="text-sm text-destructive">Couldn't render page: {error}</p>;
  return <canvas ref={canvasRef} className="max-w-full rounded border shadow-sm" />;
}

function ImagePart({ storagePath }: { storagePath: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.storage
      .from("documents")
      .createSignedUrl(storagePath, 3600)
      .then(({ data }) => {
        if (!cancelled && data) setUrl(data.signedUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [storagePath]);

  if (!url) return <p className="text-sm text-muted-foreground">Loading image…</p>;
  return <img src={url} alt="" className="max-w-full rounded border shadow-sm" />;
}

export function PartViewer({ document, parts, transcriptsByPartId, selectedOrdinal, onSelectOrdinal, highlightQuote }: PartViewerProps) {
  const part = parts.find((p) => p.ordinal === selectedOrdinal) ?? parts[0];
  const transcript = part ? transcriptsByPartId[part.id] : undefined;
  const canNavigate = parts.length > 1;

  if (!part) return <p className="text-sm text-muted-foreground">No parts to display.</p>;

  const isPdfPage = document.detected_mime === "application/pdf" && part.kind === "page";
  const isStandaloneImage = part.kind === "page" && !!part.storage_path;

  return (
    <div className="flex flex-col gap-3">
      {canNavigate && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={selectedOrdinal <= parts[0].ordinal}
            onClick={() => onSelectOrdinal(selectedOrdinal - 1)}
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <span className="text-sm text-muted-foreground">{part.label ?? `Part ${part.ordinal}`}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={selectedOrdinal >= parts[parts.length - 1].ordinal}
            onClick={() => onSelectOrdinal(selectedOrdinal + 1)}
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="flex justify-center rounded-lg border bg-muted/30 p-3">
        {isPdfPage && <PdfPageCanvas storagePath={document.storage_path} ordinal={part.ordinal} />}
        {!isPdfPage && isStandaloneImage && part.storage_path && <ImagePart storagePath={part.storage_path} />}
        {!isPdfPage && !isStandaloneImage && (
          <p className="p-4 text-sm text-muted-foreground">
            No visual for a {part.kind} part — see the transcript below.
          </p>
        )}
      </div>

      <ScrollArea className="h-64 rounded-lg border p-3" dir={transcript?.direction === "rtl" ? "rtl" : "ltr"}>
        <pre
          className={transcript?.direction === "rtl" ? "lang-ar whitespace-pre-wrap text-sm" : "whitespace-pre-wrap text-sm"}
          dir={transcript?.direction ?? "auto"}
        >
          {transcript ? renderHighlighted(transcript.text, highlightQuote) : "(no transcript yet)"}
        </pre>
      </ScrollArea>
    </div>
  );
}
