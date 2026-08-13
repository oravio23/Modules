import JSZip from "jszip";

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

/** Minimal but genuinely valid .docx — one paragraph per line, no styles/rels needed for mammoth to read the body text. */
export async function buildMinimalDocx(lines: string[]): Promise<Buffer> {
  const paragraphs = lines.map((l) => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(l)}</w:t></w:r></w:p>`).join("");
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${paragraphs}</w:body>
</w:document>`;

  const zip = new JSZip();
  zip.file("[Content_Types].xml", CONTENT_TYPES);
  zip.file("_rels/.rels", ROOT_RELS);
  zip.file("word/document.xml", documentXml);
  return zip.generateAsync({ type: "nodebuffer" });
}
