/**
 * Hand-rolled minimal single-page PDF writer — no pdf-lib dependency.
 *
 * Produces a genuinely valid PDF/1.4 file (correct xref table + trailer) with
 * one Helvetica text page, good enough for pdf.js and the ingest pipeline to
 * parse as a real "native PDF" fixture. WinAnsi/Helvetica only supports
 * Latin text — this is not used for the Arabic fixture (see
 * scripts/generate-fixtures.ts for why).
 */

function escapePdfString(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export interface MinimalPdfOptions {
  lines: string[];
  fontSize?: number;
  lineHeight?: number;
  marginTop?: number;
  marginLeft?: number;
}

export function buildMinimalPdf({ lines, fontSize = 11, lineHeight = 15, marginTop = 740, marginLeft = 50 }: MinimalPdfOptions): Buffer {
  const contentParts: string[] = [`BT`, `/F1 ${fontSize} Tf`, `${marginLeft} ${marginTop} Td`];
  lines.forEach((line, i) => {
    if (i > 0) contentParts.push(`0 -${lineHeight} Td`);
    contentParts.push(`(${escapePdfString(line)}) Tj`);
  });
  contentParts.push(`ET`);
  const content = contentParts.join("\n");
  const contentBytes = Buffer.from(content, "latin1");

  const objects: string[] = [];
  objects.push(`<< /Type /Catalog /Pages 2 0 R >>`);
  objects.push(`<< /Type /Pages /Kids [3 0 R] /Count 1 >>`);
  objects.push(
    `<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 5 0 R >> >> /MediaBox [0 0 612 792] /Contents 4 0 R >>`,
  );
  objects.push(`<< /Length ${contentBytes.length} >>\nstream\n${content}\nendstream`);
  objects.push(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`);

  let pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets: number[] = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += `0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "latin1");
}
