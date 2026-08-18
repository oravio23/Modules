import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base + basename (see src/App.tsx) must match the vercel.json rewrite for this module —
// see CONTRIBUTING.md "Deploy model". "/m<N>/" is a placeholder; set it when you copy this.
//
// `port: 5174` is this template's own placeholder — pick a port no other module already
// uses (shell is 5173, m5-documents is 5175) and update it here when you copy this file.
export default defineConfig({
  plugins: [react()],
  base: "/m<N>/",
  server: {
    host: true,
    port: 5174,
    strictPort: true,
    // In local dev this server is only ever reached through the shell's proxy at
    // :5173/m<N>/* (see CONTRIBUTING.md's "To test SSO across the shell and your module
    // locally", and apps/m5-documents/vite.config.ts for a working example) — point the
    // HMR websocket back at that origin, or the browser (sitting at :5173) tries to open a
    // WS to itself. Add a matching proxy entry for "/m<N>" and "/m<N>-hmr" to
    // apps/shell/vite.config.ts when you bring this module up locally.
    hmr: {
      host: "localhost",
      clientPort: 5173,
      path: "/m<N>-hmr",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
