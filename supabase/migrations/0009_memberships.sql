-- Memberships: the per-User subscription state all gating reads from
-- (issue #104, ADR-0021, ADR-0023).
--
-- A User has at most one Membership, keyed by owner_id. The client DERIVES
-- entitlements from the row it can read (tier + status + current_period_end);
-- absent/expired ⇒ explorer (the free baseline, ADR-0021).
--
-- RLS is SELECT-only: clients may read their own row but NEVER write it. Only
-- the service-role Stripe webhook upserts Membership state (ADR-0023), and the
-- service role bypasses RLS by design — so there is deliberately no client
-- insert / update / delete policy here.

create table if not exists memberships (
  owner_id              uuid primary key references auth.users(id) on delete cascade,
  tier                  text not null default 'explorer',
  status                text not null default 'inactive',
  current_period_end    timestamptz,
  stripe_customer_id    text,
  stripe_subscription_id text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table memberships enable row level security;

-- SELECT only: a User may read their own Membership. No insert/update/delete
-- policy — the service-role webhook is the sole writer (ADR-0023).
create policy memberships_owner_select on memberships
  for select using (auth.uid() = owner_id);
