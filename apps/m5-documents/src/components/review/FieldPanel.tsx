import { useState } from "react";
import { AlertTriangle, Check, CheckCircle2, HelpCircle, MapPin, MinusCircle, Pencil, X, XCircle } from "lucide-react";
import type { FieldResultRow, FieldStatus } from "@/integrations/supabase/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { containsArabic, suggestDirection } from "@/lib/arabic";

export const STATUS_META: Record<FieldStatus, { label: string; variant: "success" | "warning" | "destructive" | "secondary"; icon: typeof CheckCircle2 }> = {
  extracted: { label: "Extracted", variant: "success", icon: CheckCircle2 },
  missing: { label: "Missing", variant: "secondary", icon: MinusCircle },
  uncertain: { label: "Uncertain", variant: "warning", icon: HelpCircle },
  conflicting: { label: "Conflicting", variant: "destructive", icon: AlertTriangle },
  not_applicable: { label: "N/A", variant: "secondary", icon: MinusCircle },
};

export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export interface FieldPanelProps {
  field: FieldResultRow;
  isSelected: boolean;
  onSelectEvidence: (partOrdinal: number, quote: string) => void;
  onReview: (fieldId: string, action: "accepted" | "edited" | "rejected", humanValue?: unknown) => void;
}

export function FieldPanel({ field, isSelected, onSelectEvidence, onReview }: FieldPanelProps) {
  const [editing, setEditing] = useState(false);
  const [draftValue, setDraftValue] = useState(() => formatValue(field.human_value ?? field.value));

  const meta = STATUS_META[field.status];
  const Icon = meta.icon;
  const blocked = field.validator_results.some((v) => v.blocks_export);
  const hasVerifiedEvidence = field.evidence.some((e) => e.anchor === "verified");
  const reviewed = field.human_action !== null;

  return (
    <Card
      className={cn(
        blocked && "border-destructive/50",
        isSelected && "ring-2 ring-primary",
        reviewed && "opacity-80",
      )}
    >
      <CardContent className="flex flex-col gap-2 py-4">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">{field.field_label}</span>
          <div className="flex items-center gap-1.5">
            {field.status === "extracted" && !hasVerifiedEvidence && (
              <Badge variant="destructive" className="gap-1">
                <XCircle className="h-3 w-3" /> Unanchored
              </Badge>
            )}
            <Badge variant={meta.variant} className="gap-1">
              <Icon className="h-3 w-3" /> {meta.label}
            </Badge>
          </div>
        </div>

        {editing ? (
          <div className="flex items-center gap-2">
            <Input value={draftValue} onChange={(e) => setDraftValue(e.target.value)} className="font-mono text-sm" autoFocus />
            <Button
              size="icon"
              variant="default"
              onClick={() => {
                onReview(field.id, "edited", draftValue);
                setEditing(false);
              }}
              aria-label="Save edit"
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setEditing(false)} aria-label="Cancel edit">
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          (() => {
            const displayValue = formatValue(field.human_value ?? field.value);
            const isArabic = containsArabic(displayValue);
            // Arabic text in a monospace font often renders with broken
            // shaping/ligatures — switch to the Arabic-capable font and set
            // direction explicitly rather than leaving it to font fallback.
            return (
              <p className={isArabic ? "lang-ar text-sm" : "font-mono text-sm"} dir={isArabic ? "rtl" : suggestDirection(displayValue)}>
                {displayValue}
              </p>
            );
          })()
        )}

        {field.confidence !== null && (
          <p className="text-xs text-muted-foreground">Confidence: {(field.confidence * 100).toFixed(0)}%</p>
        )}
        {field.notes && <p className="text-xs italic text-muted-foreground">{field.notes}</p>}

        {field.evidence.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {field.evidence.map((e, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onSelectEvidence(e.part_ordinal, e.quote)}
                className={cn(
                  "flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs transition-colors hover:bg-accent",
                  e.anchor === "verified" ? "border-success/40 text-success" : "border-destructive/40 text-destructive",
                )}
                title={e.quote}
              >
                <MapPin className="h-3 w-3" /> p{e.part_ordinal}: “{e.quote.slice(0, 24)}
                {e.quote.length > 24 ? "…" : ""}”
              </button>
            ))}
          </div>
        )}

        {field.validator_results.some((v) => v.outcome === "fail" || v.outcome === "warn") && (
          <ul className="space-y-0.5 text-xs">
            {field.validator_results
              .filter((v) => v.outcome === "fail" || v.outcome === "warn")
              .map((v) => (
                <li key={v.id} className={v.outcome === "fail" ? "text-destructive" : "text-warning"}>
                  {v.id}: {v.message}
                </li>
              ))}
          </ul>
        )}

        <div className="mt-1 flex items-center gap-2 border-t pt-2">
          {reviewed ? (
            <span className="text-xs text-muted-foreground">
              {field.human_action === "accepted" && "Accepted"}
              {field.human_action === "edited" && "Edited"}
              {field.human_action === "rejected" && "Rejected"}
              {field.reviewed_at && ` · ${new Date(field.reviewed_at).toLocaleTimeString()}`}
            </span>
          ) : (
            <>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => onReview(field.id, "accepted")}>
                <Check className="h-3.5 w-3.5" /> Accept
              </Button>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
              <Button size="sm" variant="outline" className="gap-1 text-destructive" onClick={() => onReview(field.id, "rejected")}>
                <X className="h-3.5 w-3.5" /> Reject
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
