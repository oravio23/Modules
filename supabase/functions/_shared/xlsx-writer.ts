import JSZip from "jszip";

/**
 * Minimal, hand-rolled single-sheet XLSX writer (OOXML SpreadsheetML),
 * deliberately NOT using the "xlsx" (SheetJS) npm package server-side: that
 * package's npm-registry release has known unpatched prototype-pollution /
 * ReDoS advisories (see package.json's comment on the frontend's pinned
 * CDN-patched build). Those vulnerabilities are in its PARSING path; this
 * writer only ever emits cells from data we already produced ourselves
 * (field_results rows), so the safest choice is not depending on it here at
 * all rather than relying on "we only use the write path" holding forever.
 * Same jszip-based technique as scripts/lib/minimal-docx.ts / minimal-pptx.ts.
 */

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function colLetter(index0: number): string {
  let n = index0 + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function cellXml(value: string | number | boolean | null, colIndex: number, rowIndex: number): string {
  const ref = `${colLetter(colIndex)}${rowIndex + 1}`;
  if (value === null || value === undefined) return `<c r="${ref}"/>`;
  if (typeof value === "boolean") return `<c r="${ref}" t="b"><v>${value ? 1 : 0}</v></c>`;
  if (typeof value === "number" && Number.isFinite(value)) return `<c r="${ref}"><v>${value}</v></c>`;
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(value))}</t></is></c>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

const MINIMAL_STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="1"><fill><patternFill patternType="none"/></fill></fills>
<borders count="1"><border/></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
</styleSheet>`;

function workbookXml(sheetName: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;
}

function sheetXml(rows: (string | number | boolean | null)[][]): string {
  const rowsXml = rows
    .map((row, r) => `<row r="${r + 1}">${row.map((v, c) => cellXml(v, c, r)).join("")}</row>`)
    .join("");
  const lastCol = colLetter(Math.max(0, ...rows.map((r) => r.length - 1)));
  const dimension = rows.length > 0 ? `A1:${lastCol}${rows.length}` : "A1";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<dimension ref="${dimension}"/>
<sheetData>${rowsXml}</sheetData>
</worksheet>`;
}

export async function buildSimpleXlsx(sheetName: string, rows: (string | number | boolean | null)[][]): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", CONTENT_TYPES);
  zip.file("_rels/.rels", ROOT_RELS);
  zip.file("xl/workbook.xml", workbookXml(sheetName));
  zip.file("xl/_rels/workbook.xml.rels", WORKBOOK_RELS);
  zip.file("xl/styles.xml", MINIMAL_STYLES);
  zip.file("xl/worksheets/sheet1.xml", sheetXml(rows));
  return zip.generateAsync({ type: "uint8array" });
}
