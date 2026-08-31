-- Mietverwaltung: Datenbankschema und Row Level Security
-- Ausführen im Supabase SQL Editor (Dashboard -> SQL Editor -> New query).

-- Immobilien (Gebäude/Objekte, gehören jeweils einem Nutzer)
create table if not exists properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  address text,
  created_at timestamptz not null default now()
);

-- Wohnungen/Einheiten innerhalb einer Immobilie
create table if not exists units (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties (id) on delete cascade,
  name text not null,
  size_qm numeric,
  rooms numeric,
  created_at timestamptz not null default now()
);

-- Mieter, jeweils einer Wohnung zugeordnet
create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units (id) on delete cascade,
  name text not null,
  email text,
  phone text,
  move_in_date date,
  move_out_date date,
  created_at timestamptz not null default now()
);

-- Mietzahlungen je Mieter
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  amount numeric not null,
  due_date date not null,
  paid_date date,
  status text not null default 'offen' check (status in ('offen', 'bezahlt', 'ueberfaellig')),
  created_at timestamptz not null default now()
);

-- Row Level Security aktivieren
alter table properties enable row level security;
alter table units enable row level security;
alter table tenants enable row level security;
alter table payments enable row level security;

-- properties: Nutzer sieht/verwaltet nur eigene Immobilien
create policy "properties_owner_all" on properties
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- units: Zugriff nur über die eigene Immobilie
create policy "units_owner_all" on units
  for all
  using (exists (
    select 1 from properties p
    where p.id = units.property_id and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from properties p
    where p.id = units.property_id and p.user_id = auth.uid()
  ));

-- tenants: Zugriff nur über Wohnung -> Immobilie des Nutzers
create policy "tenants_owner_all" on tenants
  for all
  using (exists (
    select 1 from units u
    join properties p on p.id = u.property_id
    where u.id = tenants.unit_id and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from units u
    join properties p on p.id = u.property_id
    where u.id = tenants.unit_id and p.user_id = auth.uid()
  ));

-- payments: Zugriff nur über Mieter -> Wohnung -> Immobilie des Nutzers
create policy "payments_owner_all" on payments
  for all
  using (exists (
    select 1 from tenants t
    join units u on u.id = t.unit_id
    join properties p on p.id = u.property_id
    where t.id = payments.tenant_id and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from tenants t
    join units u on u.id = t.unit_id
    join properties p on p.id = u.property_id
    where t.id = payments.tenant_id and p.user_id = auth.uid()
  ));
