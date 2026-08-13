-- Grant service_role access to platform and every module schema.
--
-- WHY THIS EXISTS
-- Supabase auto-grants anon/authenticated/service_role on the `public` schema only. A schema
-- created by our own migration (platform, m1..m6) starts with NO grants for those roles, and
-- 0001/0002/0003 only ever granted to `authenticated` — service_role was never mentioned.
--
-- Every edge function talks to the database through createSupabaseAdmin()
-- (supabase/functions/_shared/supabaseAdmin.ts), which authenticates with
-- SUPABASE_SERVICE_ROLE_KEY and therefore runs as PostgREST role `service_role`. service_role
-- has BYPASSRLS, but BYPASSRLS does not imply GRANTs — so every one of those calls was failing
-- with `42501 permission denied for schema platform`, on this exact call in requireModule():
--
--     select platform.has_module(<uid>, 'm5')   -->  ERROR 42501
--
-- which requireModule() surfaced as a 500 "Entitlement check failed". That made document upload
-- fail for every user with no row ever written to m5.documents. Note EXECUTE on the platform
-- functions was already present (Postgres grants EXECUTE to PUBLIC by default) — the missing
-- piece was schema USAGE, without which the function name cannot even be resolved.
--
-- This migration is idempotent and covers m1..m6, not just m5, so the five modules still to be
-- built don't rediscover this the hard way. The ALTER DEFAULT PRIVILEGES statements are the part
-- that protects future work: without them, every new table a colleague creates in their own
-- schema would be unreachable from their edge functions all over again.

-- ── schema USAGE ─────────────────────────────────────────────────────────────
grant usage on schema platform, m1, m2, m3, m4, m5, m6 to service_role;

-- ── privileges on everything that exists today ───────────────────────────────
-- `all tables` covers views too. Safe no-op on the module schemas that are still empty.
grant all on all tables    in schema platform, m1, m2, m3, m4, m5, m6 to service_role;
grant all on all sequences in schema platform, m1, m2, m3, m4, m5, m6 to service_role;
grant execute on all functions in schema platform, m1, m2, m3, m4, m5, m6 to service_role;

-- ── privileges on everything created from here on ────────────────────────────
-- Applies to objects created by the role running migrations (the same path every module's
-- migrations go through), so a new table is reachable by its own edge functions immediately.
alter default privileges in schema platform, m1, m2, m3, m4, m5, m6
  grant all on tables to service_role;
alter default privileges in schema platform, m1, m2, m3, m4, m5, m6
  grant all on sequences to service_role;
alter default privileges in schema platform, m1, m2, m3, m4, m5, m6
  grant execute on functions to service_role;

-- Deliberately NOT touching `anon`: it has no business reading org, entitlement, or module data.
-- It currently holds USAGE on platform (from 0001) but no table privileges there, and RLS plus the
-- absence of table grants both keep it out. Module schemas grant it nothing at all.
