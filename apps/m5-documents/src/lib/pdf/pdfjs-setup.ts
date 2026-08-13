import * as pdfjsLib from "pdfjs-dist";

/**
 * One-time pdf.js runtime configuration, shared by the ingest normaliser and
 * the review-pane PartViewer. Assets are copied to public/pdfjs/ by
 * scripts/copy-pdfjs-assets.ts (runs on `npm install` via postinstall) —
 * see that script's docstring for why these can't just be ES imports.
 */
let configured = false;
export function ensurePdfJsConfigured(): typeof pdfjsLib {
  if (!configured) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
    configured = true;
  }
  return pdfjsLib;
}

export const PDF_STANDARD_FONT_DATA_URL = "/pdfjs/standard_fonts/";
export const PDF_CMAPS_URL = "/pdfjs/cmaps/";
