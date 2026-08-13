import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base + basename (see src/App.tsx) must match the vercel.json rewrite for this module —
// see CONTRIBUTING.md "Deploy model". "/m<N>/" is a placeholder; set it when you copy this.
export default defineConfig({
  plugins: [react()],
  base: "/m<N>/",
  server: {
    host: true,
    port: 5174,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
