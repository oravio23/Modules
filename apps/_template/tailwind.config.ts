import type { Config } from "tailwindcss";
import { oravioPreset } from "./src/oravio-preset";

// oravio-preset.ts is vendored by scripts/sync-ui.mjs from packages/tokens — never hand-edit
// it, edit packages/tokens/src/tailwind-preset.ts and re-sync.
export default {
  presets: [oravioPreset],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
} satisfies Config;
