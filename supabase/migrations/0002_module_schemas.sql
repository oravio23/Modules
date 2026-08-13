-- Per-module Postgres schemas. Each module owns exactly one schema and every table inside
-- it — colleagues never collide on table names or migration ordering. A module's own
-- migration (see apps/_template/supabase/migration.sql.example) creates its tables here and
-- must apply the standard org+entitlement RLS policy to every one of them.

create schema if not exists m1; -- Sourcing & Supplier Management
create schema if not exists m2; -- Booking & Freight Coordination
create schema if not exists m3; -- Shipment Visibility
create schema if not exists m4; -- Customs & Clearance Agent
create schema if not exists m5; -- Document Intelligence
create schema if not exists m6; -- Landed Cost & Reconciliation

grant usage on schema m1, m2, m3, m4, m5, m6 to authenticated;
