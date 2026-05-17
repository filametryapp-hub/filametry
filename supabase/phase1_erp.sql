-- ============================================================
-- Filametry — Phase 1 ERP Migration
-- Run this in your Supabase SQL Editor after schema.sql
-- ============================================================

-- ── 1. Create all tables first ────────────────────────────────

create table public.companies (
  id              uuid primary key default uuid_generate_v4(),
  owner_id        uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  owner_name      text not null,
  document        text,
  phone           text,
  email           text,
  address         text,
  city            text,
  state           text,
  country         text default 'US',
  is_partnership  boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.company_users (
  id          uuid primary key default uuid_generate_v4(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete set null,
  role        text not null default 'operator',
  name        text not null,
  email       text not null,
  status      text not null default 'active',
  created_at  timestamptz not null default now()
);

create table public.partners (
  id          uuid primary key default uuid_generate_v4(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  name        text not null,
  email       text,
  percentage  numeric not null check (percentage > 0 and percentage <= 100),
  created_at  timestamptz not null default now()
);

create table public.clients (
  id          uuid primary key default uuid_generate_v4(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  name        text not null,
  email       text,
  phone       text,
  document    text,
  address     text,
  city        text,
  state       text,
  country     text default 'US',
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.suppliers (
  id           uuid primary key default uuid_generate_v4(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  name         text not null,
  contact_name text,
  email        text,
  phone        text,
  document     text,
  address      text,
  city         text,
  state        text,
  country      text default 'US',
  website      text,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.expenses (
  id           uuid primary key default uuid_generate_v4(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  user_id      uuid not null references auth.users(id),
  category     text not null,
  description  text not null,
  amount       numeric not null,
  paid_at      date not null default current_date,
  supplier_id  uuid references public.suppliers(id) on delete set null,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.cash_flow (
  id           uuid primary key default uuid_generate_v4(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  user_id      uuid not null references auth.users(id),
  type         text not null,
  category     text not null,
  description  text not null,
  amount       numeric not null,
  date         date not null default current_date,
  reference_id uuid,
  created_at   timestamptz not null default now()
);

-- ── 2. Add company_id to profiles ─────────────────────────────
alter table public.profiles add column if not exists company_id uuid references public.companies(id) on delete set null;

-- ── 3. Enable RLS on all tables ───────────────────────────────
alter table public.companies    enable row level security;
alter table public.company_users enable row level security;
alter table public.partners     enable row level security;
alter table public.clients      enable row level security;
alter table public.suppliers    enable row level security;
alter table public.expenses     enable row level security;
alter table public.cash_flow    enable row level security;

-- ── 4. RLS Policies (all tables exist now) ────────────────────

-- companies
create policy "Owner can insert company"
  on public.companies for insert
  with check (auth.uid() = owner_id);

create policy "Company members can view their company"
  on public.companies for select
  using (
    auth.uid() = owner_id or
    exists (select 1 from public.company_users where company_id = companies.id and user_id = auth.uid())
  );

create policy "Owner and admins can update company"
  on public.companies for update
  using (
    auth.uid() = owner_id or
    exists (select 1 from public.company_users where company_id = companies.id and user_id = auth.uid() and role in ('owner', 'admin'))
  );

-- company_users
create policy "Company members can view company_users"
  on public.company_users for select
  using (
    user_id = auth.uid() or
    exists (select 1 from public.companies where id = company_users.company_id and owner_id = auth.uid()) or
    exists (select 1 from public.company_users cu2 where cu2.company_id = company_users.company_id and cu2.user_id = auth.uid())
  );

create policy "Owner and admins can manage company_users"
  on public.company_users for all
  using (
    exists (select 1 from public.companies where id = company_users.company_id and owner_id = auth.uid()) or
    exists (select 1 from public.company_users cu2 where cu2.company_id = company_users.company_id and cu2.user_id = auth.uid() and cu2.role in ('owner', 'admin'))
  );

-- partners
create policy "Company members can view partners"
  on public.partners for select
  using (
    exists (select 1 from public.companies where id = partners.company_id and owner_id = auth.uid()) or
    exists (select 1 from public.company_users where company_id = partners.company_id and user_id = auth.uid())
  );

create policy "Owner and admins can manage partners"
  on public.partners for all
  using (
    exists (select 1 from public.companies where id = partners.company_id and owner_id = auth.uid()) or
    exists (select 1 from public.company_users where company_id = partners.company_id and user_id = auth.uid() and role in ('owner', 'admin'))
  );

-- clients
create policy "Company members can manage clients"
  on public.clients for all
  using (
    exists (select 1 from public.companies where id = clients.company_id and owner_id = auth.uid()) or
    exists (select 1 from public.company_users where company_id = clients.company_id and user_id = auth.uid())
  );

-- suppliers
create policy "Company members can manage suppliers"
  on public.suppliers for all
  using (
    exists (select 1 from public.companies where id = suppliers.company_id and owner_id = auth.uid()) or
    exists (select 1 from public.company_users where company_id = suppliers.company_id and user_id = auth.uid())
  );

-- expenses
create policy "Company members can manage expenses"
  on public.expenses for all
  using (
    exists (select 1 from public.companies where id = expenses.company_id and owner_id = auth.uid()) or
    exists (select 1 from public.company_users where company_id = expenses.company_id and user_id = auth.uid())
  );

-- cash_flow
create policy "Company members can manage cash_flow"
  on public.cash_flow for all
  using (
    exists (select 1 from public.companies where id = cash_flow.company_id and owner_id = auth.uid()) or
    exists (select 1 from public.company_users where company_id = cash_flow.company_id and user_id = auth.uid())
  );

-- ── 5. Updated_at triggers ────────────────────────────────────
create trigger set_updated_at before update on public.companies
  for each row execute procedure public.set_updated_at();
create trigger set_updated_at before update on public.clients
  for each row execute procedure public.set_updated_at();
create trigger set_updated_at before update on public.suppliers
  for each row execute procedure public.set_updated_at();
create trigger set_updated_at before update on public.expenses
  for each row execute procedure public.set_updated_at();

-- ── 6. Indexes ────────────────────────────────────────────────
create index on public.companies      (owner_id);
create index on public.company_users  (company_id);
create index on public.company_users  (user_id);
create index on public.partners       (company_id);
create index on public.clients        (company_id);
create index on public.suppliers      (company_id);
create index on public.expenses       (company_id, paid_at);
create index on public.cash_flow      (company_id, date);
