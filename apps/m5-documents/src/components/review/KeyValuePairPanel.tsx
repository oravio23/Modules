import { useState } from "react";
import { Check, MapPin, Pencil, X, XCircle } from "lucide-react";
import type { FieldResultRow, FieldStatus } from "@/integrations/supabase/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { containsArabic, suggestDirection } from "@/lib/arabic";
import { formatValue, STATUS_META } from "./FieldPanel";

export interface ReviewUpdate {
  fieldId: string;
  action: "accepted" | "edited" | "rejected";
  humanValue?: unknown;
}

export interface KeyValuePairPanelProps {
  labelField: FieldResultRow;
  valueField: FieldResultRow;
  isSelected: boolean;
  onSelectEvidence: (partOrdinal: number, quote: string) => void;
  onReview: (updates: ReviewUpdate[]) => void;
}

/**
 * Renders one `key_values[i]` row (the generic profile's open-ended
 * label/value repeating group) as a single card instead of the two separate
 * FieldPanel cards a label-field and value-field would otherwise produce —
 * a document with many labelled fields was turning into twice as many
 * review cards as it had actual fields.
 */
export function KeyValuePairPanel({ labelField, valueField, isSelected, onSelectEvidence, onReview }: KeyValuePairPanelProps) {
  const [editing, setEditing] = useState(false);
  const [draftLabel, setDraftLabel] = useState(() => formatValue(labelField.human_value ?? labelField.value));
  const [draftValue, setDraftValue] = useState(() => formatValue(valueField.human_value ?? valueField.value));

  // The value is what's actually being reviewed; only fall back to the label's status if the value has nothing more specific to say.
  const status: FieldStatus = valueField.status === "extracted" ? labelField.status : valueField.status;
  const meta = STATUS_META[status];
  const Icon = meta.icon;

  const evidence = [...labelField.evidence, ...valueField.evidence];
  const validatorResults = [...labelField.validator_results, ...valueField.validator_results];
  const hasVerifiedEvidence = evidence.some((e) => e.anchor === "verified");
  const blocked = validatorResults.some((v) => v.blocks_export);
  const reviewed = labelField.human_action !== null && valueField.human_action !== null;

  const displayLabel = formatValue(labelField.human_value ?? labelField.value);
  const displayValue = formatValue(valueField.human_value ?? valueField.value);

  function runReview(action: "accepted" | "edited" | "rejected", humanLabel?: unknown, humanValue?: unknown) {
    onReview([
      { fieldId: labelField.id, action, humanValue: humanLabel },
      { fieldId: valueField.id, action, humanValue: humanValue },
    ]);
  }

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
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Key-value</span>
          <div className="flex items-center gap-1.5">
            {valueField.status === "extracted" && !hasVerifiedEvidence && (
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
          <div className="flex flex-col gap-2">
            <Input value={draftLabel} onChange={(e) => setDraftLabel(e.target.value)} className="font-mono text-sm" placeholder="Label" autoFocus />
            <div className="flex items-center gap-2">
              <Input value={draftValue} onChange={(e) => setDraftValue(e.target.value)} className="font-mono text-sm" placeholder="Value" />
              <Button
                size="icon"
                variant="default"
                onClick={() => {
                  runReview("edited", draftLabel, draftValue);
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
          </div>
        ) : (
          (() => {
            const combined = `${displayLabel}: ${displayValue}`;
            const isArabic = containsArabic(combined);
            return (
              <p className={isArabic ? "lang-ar text-sm" : "font-mono text-sm"} dir={isArabic ? "rtl" : suggestDirection(combined)}>
                <span className="text-muted-foreground">{displayLabel}:</span> {displayValue}
              </p>
            );
          })()
        )}

        {evidence.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {evidence.map((e, i) => (
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

        {validatorResults.some((v) => v.outcome === "fail" || v.outcome === "warn") && (
          <ul className="space-y-0.5 text-xs">
            {validatorResults
              .filter((v) => v.outcome === "fail" || v.outcome === "warn")
              .map((v, i) => (
                <li key={`${v.id}-${i}`} className={v.outcome === "fail" ? "text-destructive" : "text-warning"}>
                  {v.id}: {v.message}
                </li>
              ))}
          </ul>
        )}

        <div className="mt-1 flex items-center gap-2 border-t pt-2">
          {reviewed ? (
            <span className="text-xs text-muted-foreground">
              {valueField.human_action === "accepted" && "Accepted"}
              {valueField.human_action === "edited" && "Edited"}
              {valueField.human_action === "rejected" && "Rejected"}
              {valueField.reviewed_at && ` · ${new Date(valueField.reviewed_at).toLocaleTimeString()}`}
            </span>
          ) : (
            <>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => runReview("accepted")}>
                <Check className="h-3.5 w-3.5" /> Accept
              </Button>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
              <Button size="sm" variant="outline" className="gap-1 text-destructive" onClick={() => runReview("rejected")}>
                <X className="h-3.5 w-3.5" /> Reject
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
