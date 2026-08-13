import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base + basename (see src/App.tsx) must match apps/shell/vercel.json's /m5/* rewrite —
// see CONTRIBUTING.md "Deploy model".
export default defineConfig({
  plugins: [react()],
  base: "/m5/",
  server: {
    host: true,
    port: 5175,
    strictPort: true,
    // In local dev this server is only ever reached through the shell's proxy at
    // :5173/m5/* (see apps/shell/vite.config.ts) — point the HMR websocket back at
    // that origin, or the browser (sitting at :5173) tries to open a WS to itself.
    hmr: {
      host: "localhost",
      clientPort: 5173,
      path: "/m5-hmr",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
