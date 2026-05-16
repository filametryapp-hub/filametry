-- ============================================================
-- Filametry — Add printer_limit to profiles & user_printers table
-- Run this in your Supabase SQL Editor after deploying the schema.sql
-- ============================================================

-- Add printer_limit column to profiles (defaults to 2, matching Starter / trial)
alter table public.profiles
  add column if not exists printer_limit integer not null default 2;

-- ── User Printers ────────────────────────────────────────────
create table if not exists public.user_printers (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  brand           text not null,
  model           text not null,
  watts           numeric not null default 120,
  build_volume_mm jsonb,
  is_default      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.user_printers enable row level security;

create policy "Users manage own printers"
  on public.user_printers for all using (auth.uid() = user_id);

create index on public.user_printers (user_id);

-- Auto-update updated_at on user_printers
create trigger set_updated_at before update on public.user_printers
  for each row execute procedure public.set_updated_at();
