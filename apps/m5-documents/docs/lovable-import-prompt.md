# Prompt for Lovable

Paste the block below into Lovable's chat after importing this repo (GitHub → Lovable, or Lovable's own
"import existing project" flow) and connecting its native Supabase integration. It walks Lovable through
the Supabase-side setup this app depends on — see
[docs/lovable-handoff-runbook.md](lovable-handoff-runbook.md) for the full reasoning and evidence behind
each step, and §0 there for a security note (rotate `ANTHROPIC_API_KEY`) to handle before you start.

---

```
This project is already built — a document-extraction pilot (Vite + React + TypeScript + Tailwind +
shadcn/ui frontend, Supabase backend: Postgres, Storage, Auth, Edge Functions, Realtime). I need help
finishing the Supabase Cloud setup so it runs on real hosted infrastructure instead of my local machine.
Please do the following, in order, and tell me clearly if any step fails or behaves unexpectedly rather
than assuming it worked:

1. Connect a Supabase Cloud project to this app (create a new one if I don't already have one linked).

2. Apply every SQL migration in supabase/migrations/ to that project, in filename order
   (0001_init.sql, 0002_grants.sql, 0003_seed_profiles.sql). 0003 seeds a `profiles` table that
   `extractions.profile_id` has a NOT NULL foreign key into — if that migration doesn't run, every
   document upload will fail after transcribing and classifying, right when it tries to save results.
   Confirm afterward that `select id from profiles;` returns two rows: 'generic' and 'commercial_invoice'.

3. Enable anonymous sign-ins in the Supabase Auth settings for this project (Authentication → Sign In /
   Providers → "Allow anonymous sign-ins"). This app has no login page at all — every session is
   anonymous — so without this toggle on, nothing can authenticate and every request will fail.

4. Confirm a private Storage bucket named 'documents' exists with RLS policies restricting access to each
   row's owner, and that the `jobs` table is added to the Realtime publication (the UI polls it for live
   pipeline-stage progress). Both should already be defined in the migrations — just confirm they took
   effect rather than assuming it.

5. Deploy all three Edge Functions in supabase/functions/: documents-register, pipeline-worker, and
   export-result.

6. Set ANTHROPIC_API_KEY as a Supabase secret on this project (I'll give you the value separately — never
   put it in a file, an env var prefixed VITE_, or anywhere the frontend bundle could read it). Confirm it
   only needs to exist as a server-side Edge Function secret.

7. Set these two frontend environment variables for this project (from the Supabase dashboard's API
   settings page): VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. Note some dashboards now label these
   "publishable key" instead of "anon key" — same value, just confirm you're using the public/anon-tier
   key, not the secret/service-role one.

8. Once all of the above is done, walk me through a smoke test: I'll upload a small file and we should
   see it move through transcribe → classify → extract → review stages. If anything fails, show me the
   actual error from the jobs table's last_error column rather than just saying "it didn't work."

Do not run `supabase db push` with `--include-seed` or rely on any local Docker-only behavior — this
project has only ever been tested against a local Docker Supabase stack before now, so treat every one of
these steps as unverified against real infrastructure until we've confirmed it ourselves.
```
