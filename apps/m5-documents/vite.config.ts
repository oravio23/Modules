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
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
