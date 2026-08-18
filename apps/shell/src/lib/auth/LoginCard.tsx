// Kept as a re-export so existing imports (apps/shell/src/pages/Landing.tsx,
// apps/_template/src/...) don't need to change. The actual component — now offering
// password sign-in/sign-up, magic link, and forgot-password, with OAuth gated behind
// VITE_ENABLE_OAUTH — lives in AuthCard.tsx.
export { AuthCard as LoginCard } from "./AuthCard";
