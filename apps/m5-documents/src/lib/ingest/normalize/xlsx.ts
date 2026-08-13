import type { FileLike, NormalizedPart, NormalizeResult } from "../types.ts";

/** Render a sheet's rows as a markdown table — compact, and something an LLM reads natively. */
function rowsToMarkdownTable(rows: unknown[][]): string {
  if (rows.length === 0) return "(empty sheet)";
  const cell = (v: unknown) => (v === undefined || v === null ? "" : String(v).replace(/\|/g, "\\|"));
  const width = Math.max(...rows.map((r) => r.length));
  const lines: string[] = [];
  rows.forEach((row, i) => {
    const padded = Array.from({ length: width }, (_, c) => cell(row[c]));
    lines.push(`| ${padded.join(" | ")} |`);
    if (i === 0) lines.push(`| ${padded.map(() => "---").join(" | ")} |`);
  });
  return lines.join("\n");
}

/** XLSX, XLS, and CSV/TSV-as-spreadsheet — one part per sheet (CSV has exactly one). */
export async function normalizeXlsx(file: FileLike): Promise<NormalizeResult> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(file.bytes, { type: "array" });
  const parts: NormalizedPart[] = workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });
    return {
      kind: "sheet" as const,
      label: `Sheet: ${name}`,
      text: rowsToMarkdownTable(rows),
    };
  });
  if (parts.length === 0) {
    return { parts: [], warnings: [`${file.filename}: workbook has no sheets`] };
  }
  return { parts, warnings: [] };
}
