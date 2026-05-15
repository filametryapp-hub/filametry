-- ============================================================
-- Filametry — Database Schema
-- Run this in your Supabase SQL Editor (supabase.com/dashboard)
-- ============================================================

-- ── Extensions ──────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Profiles ────────────────────────────────────────────────
-- One row per auth user, created automatically on sign-up
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  full_name       text,
  avatar_url      text,
  plan            text not null default 'trial',   -- trial | pro | cancelled
  trial_ends_at   timestamptz not null default (now() + interval '7 days'),
  stripe_customer_id     text,
  stripe_subscription_id text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on sign-up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Filaments ────────────────────────────────────────────────
create table public.filaments (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  brand        text not null,
  material     text not null,
  color        text not null,
  color_hex    text not null default '#ff6b35',
  weight_g     numeric not null default 1000,
  remaining_g  numeric not null default 1000,
  price_usd    numeric not null,
  purchased_at date,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.filaments enable row level security;

create policy "Users manage own filaments"
  on public.filaments for all using (auth.uid() = user_id);

-- ── Products ─────────────────────────────────────────────────
create table public.products (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  description  text,
  material     text not null,
  weight_g     numeric not null default 0,
  print_hours  numeric not null default 0,
  cost_usd     numeric not null default 0,
  price_usd    numeric not null default 0,
  image_url    text,
  tags         text[] not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.products enable row level security;

create policy "Users manage own products"
  on public.products for all using (auth.uid() = user_id);

-- ── Orders ───────────────────────────────────────────────────
create type public.order_status as enum (
  'draft', 'sent', 'accepted', 'printing', 'done', 'cancelled'
);

create table public.orders (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  client_name  text not null,
  client_email text,
  status       public.order_status not null default 'draft',
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.orders enable row level security;

create policy "Users manage own orders"
  on public.orders for all using (auth.uid() = user_id);

-- ── Order Items ──────────────────────────────────────────────
create table public.order_items (
  id           uuid primary key default uuid_generate_v4(),
  order_id     uuid not null references public.orders(id) on delete cascade,
  product_id   uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity     integer not null default 1,
  unit_price   numeric not null,
  created_at   timestamptz not null default now()
);

alter table public.order_items enable row level security;

create policy "Users manage own order items"
  on public.order_items for all
  using (
    auth.uid() = (select user_id from public.orders where id = order_id)
  );

-- ── Updated_at triggers ──────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();
create trigger set_updated_at before update on public.filaments
  for each row execute procedure public.set_updated_at();
create trigger set_updated_at before update on public.products
  for each row execute procedure public.set_updated_at();
create trigger set_updated_at before update on public.orders
  for each row execute procedure public.set_updated_at();

-- ── Indexes ──────────────────────────────────────────────────
create index on public.filaments (user_id);
create index on public.products  (user_id);
create index on public.orders    (user_id, status);
create index on public.order_items (order_id);
