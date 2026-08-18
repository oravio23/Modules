import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Self-hosted variable fonts (no CDN, no request outside the bundle) — see
// packages/tokens/src/tokens.css for --font-sans/--font-mono, which reference these by name.
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "./index.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
