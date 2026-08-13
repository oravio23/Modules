import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  // Fails loudly at startup rather than producing confusing "fetch failed"
  // errors deep inside a query — see .env.example for what to set.
  throw new Error(
    "VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. Copy .env.example to .env.local and fill them in (see that file for where to get them).",
  );
}

// Untyped client, deliberately, matching the M5 module's convention: a hand-written
// Database type without the Relationships/Views/Functions shape supabase-js expects
// collapses query builder types to `never` instead of helping. Regenerate with
// `supabase gen types` once real per-module schemas stabilize, then reinstate
// `createClient<Database>(...)` here.
export const supabase = createClient(url, anonKey);
