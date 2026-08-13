import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { UploadCloud, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { uploadDocument, type UploadPhase } from "@/lib/upload/uploadDocument";
import { IngestRejectedError } from "@/lib/ingest/normalize/index";

const PHASE_LABEL: Record<UploadPhase, string> = {
  reading: "Reading file…",
  detecting: "Detecting format…",
  normalizing: "Extracting content…",
  uploading_original: "Uploading original…",
  uploading_parts: "Uploading parts…",
  registering: "Registering with pipeline…",
  done: "Done",
};

export function UploadDropzone() {
  const [isDragging, setIsDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<UploadPhase | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      setBusy(true);
      try {
        const result = await uploadDocument(file, setPhase);
        if (result.warnings.length > 0) {
          toast.warning(`Uploaded with ${result.warnings.length} warning(s)`, {
            description: result.warnings.slice(0, 3).join(" · "),
          });
        } else {
          toast.success("Document uploaded — processing started");
        }
        navigate("/queue");
      } catch (err) {
        if (err instanceof IngestRejectedError) {
          toast.error("Couldn't accept this file", { description: err.message });
        } else {
          toast.error("Upload failed", { description: (err as Error).message });
        }
      } finally {
        setBusy(false);
        setPhase(null);
      }
    },
    [navigate],
  );

  return (
    <Card
      className={cn(
        "border-2 border-dashed transition-colors",
        isDragging ? "border-primary bg-accent" : "border-border",
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        void handleFiles(e.dataTransfer.files);
      }}
    >
      <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
        {busy ? (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden="true" />
            <p className="text-sm font-medium">{phase ? PHASE_LABEL[phase] : "Working…"}</p>
          </>
        ) : (
          <>
            <UploadCloud className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="font-medium">Drag & drop a file here</p>
              <p className="text-sm text-muted-foreground">or</p>
            </div>
            <Button onClick={() => inputRef.current?.click()}>Choose a file</Button>
            <input
              ref={inputRef}
              type="file"
              className="sr-only"
              onChange={(e) => void handleFiles(e.target.files)}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
