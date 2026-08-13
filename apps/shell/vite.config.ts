import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The shell owns the origin root ("/") — every module app is rewritten under its own
// "/m<N>/" path alongside it (see vercel.json). See CONTRIBUTING.md "Deploy model".
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
