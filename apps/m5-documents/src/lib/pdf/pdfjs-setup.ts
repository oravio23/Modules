import * as pdfjsLib from "pdfjs-dist";

/**
 * One-time pdf.js runtime configuration, shared by the ingest normaliser and
 * the review-pane PartViewer. Assets are copied to public/pdfjs/ by
 * scripts/copy-pdfjs-assets.ts (runs on `npm install` via postinstall) —
 * see that script's docstring for why these can't just be ES imports.
 *
 * Paths are built from Vite's BASE_URL, not hardcoded as root-absolute — this app is
 * served under "/m5/" (see vite.config.ts's `base`), so a bare "/pdfjs/..." would point
 * at the shell's origin root instead of this app's own assets.
 */
const PDFJS_BASE_URL = `${import.meta.env.BASE_URL}pdfjs/`;

let configured = false;
export function ensurePdfJsConfigured(): typeof pdfjsLib {
  if (!configured) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE_URL}pdf.worker.min.mjs`;
    configured = true;
  }
  return pdfjsLib;
}

export const PDF_STANDARD_FONT_DATA_URL = `${PDFJS_BASE_URL}standard_fonts/`;
export const PDF_CMAPS_URL = `${PDFJS_BASE_URL}cmaps/`;
