import JSZip from "jszip";

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function contentTypesXml(slideCount: number): string {
  const overrides = Array.from({ length: slideCount }, (_, i) =>
    `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`,
  ).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
${overrides}
</Types>`;
}

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`;

function presentationXml(slideCount: number): string {
  const sldIds = Array.from({ length: slideCount }, (_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<p:sldIdLst>${sldIds}</p:sldIdLst>
</p:presentation>`;
}

function presentationRels(slideCount: number): string {
  const rels = Array.from(
    { length: slideCount },
    (_, i) =>
      `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`,
  ).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`;
}

function slideXml(lines: string[]): string {
  const runs = lines
    .map((l) => `<a:p><a:r><a:t>${escapeXml(l)}</a:t></a:r></a:p>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:cSld><p:spTree><p:sp><p:txBody>${runs}</p:txBody></p:sp></p:spTree></p:cSld>
</p:sld>`;
}

/** Minimal but genuinely valid .pptx — one slide per array of lines. */
export async function buildMinimalPptx(slides: string[][]): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", contentTypesXml(slides.length));
  zip.file("_rels/.rels", ROOT_RELS);
  zip.file("ppt/presentation.xml", presentationXml(slides.length));
  zip.file("ppt/_rels/presentation.xml.rels", presentationRels(slides.length));
  slides.forEach((lines, i) => {
    zip.file(`ppt/slides/slide${i + 1}.xml`, slideXml(lines));
  });
  return zip.generateAsync({ type: "nodebuffer" });
}
