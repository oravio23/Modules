import type { Config } from "tailwindcss";
import { oravioPreset } from "./src/oravio-preset";

// oravio-preset.ts is vendored by scripts/sync-ui.mjs from packages/tokens — never hand-edit
// it, edit packages/tokens/src/tailwind-preset.ts and re-sync. This replaces the module's
// original hand-authored HSL palette (navy #221 70% 32%, unreachable .dark block, Inter/Noto
// Naskh Arabic never actually loaded) with the real oravio.co brand tokens shared by every
// module — see the design plan's "three-way brand conflict" note.
export default {
  presets: [oravioPreset],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
} satisfies Config;
