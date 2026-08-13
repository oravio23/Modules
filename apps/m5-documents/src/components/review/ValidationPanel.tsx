import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { FieldResultRow } from "@/integrations/supabase/types";

interface ValidationPanelProps {
  summary: { pass: number; warn: number; fail: number; not_applicable: number; blocks_export: boolean };
  fields: FieldResultRow[];
}

export function ValidationPanel({ summary, fields }: ValidationPanelProps) {
  const unanchoredCritical = fields.filter(
    (f) => f.status === "extracted" && !f.evidence.some((e) => e.anchor === "verified") && f.validator_results.some((v) => v.id === "EVD-001" && v.blocks_export),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Validation</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="success">{summary.pass} pass</Badge>
          <Badge variant="warning">{summary.warn} warn</Badge>
          <Badge variant="destructive">{summary.fail} fail</Badge>
          <Badge variant="secondary">{summary.not_applicable} n/a</Badge>
        </div>
        {summary.blocks_export && (
          <p className="text-sm font-medium text-destructive">
            Export is blocked — {unanchoredCritical.length > 0 ? "one or more critical fields lack verified evidence" : "one or more validators failed"}.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Every field requires human review before export, regardless of validator outcome — this is a pilot-period
          policy, not a suggestion.
        </p>
      </CardContent>
    </Card>
  );
}
