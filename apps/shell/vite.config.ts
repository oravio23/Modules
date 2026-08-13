import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The shell owns the origin root ("/") — every module app is rewritten under its own
// "/m<N>/" path alongside it (see vercel.json). See CONTRIBUTING.md "Deploy model".
//
// The dev proxy below reproduces that same single-origin rewrite locally: without it,
// each module's own `vite dev` server sits on its own port, which is a different origin
// from the shell's — so the Supabase session in localStorage (the whole point of SSO)
// never carries over, and a module always looks broken when opened through the shell in
// local dev. Add a line here for every module app you bring up locally alongside the shell.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/m5": {
        target: "http://localhost:5175",
        changeOrigin: true,
        ws: true,
      },
      "/m5-hmr": {
        target: "http://localhost:5175",
        changeOrigin: true,
        ws: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
