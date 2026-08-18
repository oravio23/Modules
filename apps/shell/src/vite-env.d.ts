/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  // Off by default (unset/anything but "true"). See AuthCard.tsx and
  // docs/deploy-checklist.md — neither Google nor Microsoft OAuth is configured yet.
  readonly VITE_ENABLE_OAUTH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
