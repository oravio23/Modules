-- Oravio platform — shared core schema
-- PROPOSED: commercial plan definitions below are placeholders until packaging is decided
-- by the business; the org/membership/entitlement structure itself is not provisional.
--
-- One Supabase project serves every module (m1..m6) so there is exactly one auth.users
-- table and one JWT issuer — that is what makes single sign-on possible. Enforcement of
-- entitlements lives in three layers and all three are required: the hub UI graying out a
-- card is UX only; platform.has_module() inside each module's RLS policies, and
-- requireModule() in each module's edge functions, are the actual security boundary.

create extension if not exists "pgcrypto";

create schema if not exists platform;

-- ── orgs & membership ────────────────────────────────────────────────────────

create table platform.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  country text,
  created_at timestamptz not null default now()
);

create table platform.org_members (
  org_id uuid not null references platform.orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

-- ── module catalogue — mirrors oravio.co's six-module story exactly, so the hub and the
--    marketing site can never disagree about names, order, or status ──────────────────

create table platform.modules (
  id text primary key,                 -- 'm1' .. 'm6'
  slug text unique not null,           -- 'documents'
  name text not null,
  tagline text not null,
  personas text[] not null,
  status text not null check (status in ('live', 'beta', 'planned')),
  route text not null,                 -- '/m5'
  sort_order int not null
);

-- ── plans & entitlements ─────────────────────────────────────────────────────

create table platform.plans (
  id text primary key,
  name text not null,
  description text
);

create table platform.plan_modules (
  plan_id text not null references platform.plans(id) on delete cascade,
  module_id text not null references platform.modules(id) on delete cascade,
  primary key (plan_id, module_id)
);

create table platform.org_subscriptions (
  org_id uuid primary key references platform.orgs(id) on delete cascade,
  plan_id text not null references platform.plans(id),
  status text not null check (status in ('trial', 'active', 'past_due', 'canceled')),
  seats int not null default 5,
  current_period_end timestamptz
);

-- Pilot one-offs (a customer gets an extra module without a bespoke plan) without inventing
-- a new plan per customer. An override's `granted` value always wins over the plan grant.
create table platform.org_module_overrides (
  org_id uuid not null references platform.orgs(id) on delete cascade,
  module_id text not null references platform.modules(id) on delete cascade,
  granted boolean not null,
  note text,
  primary key (org_id, module_id)
);

-- ── entitlement resolution — the security boundary every module's RLS must call ────────

-- Resolves per org the user belongs to (override wins over plan grant for that org), then
-- OR's across every org they're a member of — a user gets a module if ANY of their orgs
-- grants it. A single arbitrary row picked via LIMIT 1 across all orgs would let one org's
-- deny override another org's paid grant (or vice versa) for a multi-org user.
create or replace function platform.has_module(p_user uuid, p_module text)
returns boolean
language sql
stable
security definer
set search_path = platform, public
as $$
  select coalesce(
    bool_or(
      coalesce(
        omo.granted,
        coalesce(s.status, 'none') in ('trial', 'active')
          and exists (
            select 1 from platform.plan_modules pm
            where pm.plan_id = s.plan_id and pm.module_id = p_module
          )
      )
    ),
    false
  )
  from platform.org_members m
  left join platform.org_subscriptions s on s.org_id = m.org_id
  left join platform.org_module_overrides omo
    on omo.org_id = m.org_id and omo.module_id = p_module
  where m.user_id = p_user;
$$;

-- One RPC call gives the hub every module row plus this user's grant state. Deliberately
-- returns all six modules (not just granted ones) so locked modules stay discoverable,
-- mirroring the marketing site's six-module story rather than hiding the rest of the platform.
create or replace function platform.my_modules()
returns table (
  id text, slug text, name text, tagline text, personas text[],
  status text, route text, sort_order int, granted boolean
)
language sql
stable
security definer
set search_path = platform, public
as $$
  select m.id, m.slug, m.name, m.tagline, m.personas, m.status, m.route, m.sort_order,
         platform.has_module(auth.uid(), m.id) as granted
    from platform.modules m
   order by m.sort_order;
$$;

-- A policy on org_members cannot subquery org_members directly in its own USING clause —
-- Postgres reports "infinite recursion detected in policy for relation \"org_members\"".
-- Resolving the caller's org ids through a SECURITY DEFINER function sidesteps this: the
-- function body runs as its owner (bypassing RLS on the table it reads), so the policies
-- below query the function instead of the protected table.
create or replace function platform.my_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = platform, public
as $$
  select org_id from platform.org_members where user_id = auth.uid();
$$;

grant execute on function platform.my_org_ids() to authenticated;

-- ── RLS ──────────────────────────────────────────────────────────────────────

alter table platform.orgs enable row level security;
alter table platform.org_members enable row level security;
alter table platform.modules enable row level security;
alter table platform.plans enable row level security;
alter table platform.plan_modules enable row level security;
alter table platform.org_subscriptions enable row level security;
alter table platform.org_module_overrides enable row level security;

-- Catalogue tables: readable by every authenticated user (needed to render locked cards
-- and plan-upgrade prompts); writable only by service role (dashboard/admin tooling).
create policy modules_read on platform.modules for select to authenticated using (true);
create policy plans_read on platform.plans for select to authenticated using (true);
create policy plan_modules_read on platform.plan_modules for select to authenticated using (true);

-- Org-scoped tables: visible only to members of that org. All four go through
-- my_org_ids() rather than querying org_members directly — org_members_read querying
-- org_members from within its own policy is exactly the infinite-recursion case above.
create policy orgs_member_read on platform.orgs for select to authenticated
  using (id in (select platform.my_org_ids()));

create policy org_members_read on platform.org_members for select to authenticated
  using (org_id in (select platform.my_org_ids()));

create policy org_subscriptions_read on platform.org_subscriptions for select to authenticated
  using (org_id in (select platform.my_org_ids()));

-- Overrides are service-role write only (support/ops grants a pilot one-off manually);
-- members can read their own org's overrides so the UI can explain a locked-vs-granted state.
create policy org_module_overrides_read on platform.org_module_overrides for select to authenticated
  using (org_id in (select platform.my_org_ids()));

-- ── grants — RLS is checked *after* GRANTs, so both are required ────────────────────────

grant usage on schema platform to authenticated, anon;

grant select on platform.modules, platform.plans, platform.plan_modules to authenticated;
grant select on platform.orgs, platform.org_members, platform.org_subscriptions,
  platform.org_module_overrides to authenticated;

grant execute on function platform.has_module(uuid, text) to authenticated;
grant execute on function platform.my_modules() to authenticated;

-- ── seed: module catalogue, from oravio.co's live six-module copy ───────────────────────

insert into platform.modules (id, slug, name, tagline, personas, status, route, sort_order) values
  ('m1', 'sourcing', 'Sourcing & Supplier Management',
   'POs, supplier acknowledgements, compliance documents, and supplier scorecards before cargo moves.',
   array['suppliers', 'importers', 'exporters'], 'planned', '/m1', 1),
  ('m2', 'booking', 'Booking & Freight Coordination',
   'Carrier booking, ETD confirmation, multi-modal coordination, and booking-to-tracking handoff.',
   array['exporters', 'importers', 'forwarders'], 'planned', '/m2', 2),
  ('m3', 'visibility', 'Shipment Visibility',
   'Live dashboard for inbound and outbound shipments with ETAs, milestones, documents, owners, and audit trail.',
   array['importers', 'exporters', 'suppliers'], 'live', '/m3', 3),
  ('m4', 'customs', 'Customs & Clearance Agent',
   'Arabic and English HS classification, tariff context, confidence scoring, and ASYCUDA-ready output.',
   array['customs brokers', 'importers'], 'planned', '/m4', 4),
  ('m5', 'documents', 'Document Intelligence',
   'Shipping line email parsing and OCR for BLs, COOs, invoices, releases, and payment proof.',
   array['forwarders', 'brokers', 'importers'], 'planned', '/m5', 5),
  ('m6', 'landed-cost', 'Landed Cost & Reconciliation',
   'Duty, VAT, freight, clearance, transport, and invoice variance reconciled per shipment and SKU.',
   array['importers', 'exporters', 'finance teams'], 'planned', '/m6', 6);

-- PROPOSED — packaging is a business decision, not a code one; these three starter plans
-- exist so the entitlement model has something to test against before real pricing lands.
insert into platform.plans (id, name, description) values
  ('broker', 'Broker', 'Customs & Clearance Agent + Document Intelligence'),
  ('importer', 'Importer', 'Sourcing, Shipment Visibility, and Landed Cost & Reconciliation'),
  ('full', 'Full Platform', 'All six modules');

insert into platform.plan_modules (plan_id, module_id) values
  ('broker', 'm4'), ('broker', 'm5'),
  ('importer', 'm1'), ('importer', 'm3'), ('importer', 'm6'),
  ('full', 'm1'), ('full', 'm2'), ('full', 'm3'), ('full', 'm4'), ('full', 'm5'), ('full', 'm6');
