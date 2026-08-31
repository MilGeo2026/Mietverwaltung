-- Nebenkostenabrechnung: zusätzliche Tabellen und RLS-Policies
-- Ausführen im Supabase SQL Editor (Dashboard -> SQL Editor -> New query),
-- NACHDEM supabase/schema.sql bereits eingespielt wurde.

-- Monatliche Nebenkosten-Vorauszahlung je Mieter
alter table tenants add column if not exists advance_payment_monthly numeric;

-- Eine Abrechnung je Immobilie und Zeitraum (z.B. "Nebenkostenabrechnung 2025")
create table if not exists cost_statements (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties (id) on delete cascade,
  title text not null,
  period_start date not null,
  period_end date not null,
  created_at timestamptz not null default now()
);

-- Kostenpositionen einer Abrechnung (z.B. Heizung, Wasser, Müll ...)
create table if not exists cost_items (
  id uuid primary key default gen_random_uuid(),
  statement_id uuid not null references cost_statements (id) on delete cascade,
  category text not null,
  amount numeric not null,
  allocation_key text not null default 'sqm' check (allocation_key in ('sqm', 'unit')),
  created_at timestamptz not null default now()
);

alter table cost_statements enable row level security;
alter table cost_items enable row level security;

-- cost_statements: Zugriff nur über die eigene Immobilie
drop policy if exists "cost_statements_owner_all" on cost_statements;
create policy "cost_statements_owner_all" on cost_statements
  for all
  using (exists (
    select 1 from properties p
    where p.id = cost_statements.property_id and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from properties p
    where p.id = cost_statements.property_id and p.user_id = auth.uid()
  ));

-- cost_items: Zugriff nur über Abrechnung -> Immobilie des Nutzers
drop policy if exists "cost_items_owner_all" on cost_items;
create policy "cost_items_owner_all" on cost_items
  for all
  using (exists (
    select 1 from cost_statements s
    join properties p on p.id = s.property_id
    where s.id = cost_items.statement_id and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from cost_statements s
    join properties p on p.id = s.property_id
    where s.id = cost_items.statement_id and p.user_id = auth.uid()
  ));
