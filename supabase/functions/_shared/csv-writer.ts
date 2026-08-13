/** Minimal RFC-4180-ish CSV writer — no dependency needed for this. */
function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function buildCsv(rows: unknown[][]): string {
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n") + "\r\n";
}
