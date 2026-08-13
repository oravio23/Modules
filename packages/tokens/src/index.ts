export { oravioPreset, default as tailwindPreset } from "./tailwind-preset.ts";

/**
 * The twelve canonical Oravio brand hexes, measured live from oravio.co/style.css.
 * Mirrors the :root values in tokens.css — kept here so code (not just CSS) can reference
 * them, and so __parity__.test.ts has a single source to diff tokens.css against.
 */
export const ORAVIO_BRAND_TOKENS = {
  ink: "#121938",
  muted: "#626b7d",
  line: "#dce2ea",
  paper: "#f7f9fb",
  panel: "#fff",
  field: "#edf5f4",
  teal: "#087c75",
  "teal-dark": "#045f5b",
  navy: "#111832",
  "navy-soft": "#1c2648",
  amber: "#b97823",
  blue: "#2f6f9e",
} as const;

export type OravioBrandToken = keyof typeof ORAVIO_BRAND_TOKENS;
