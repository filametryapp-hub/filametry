-- Saved pricing calculator sessions
-- Stores the full calculator state so users can reload previous calculations
create table if not exists public.pricing_sessions (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  batches     jsonb not null default '[]',
  shared      jsonb not null default '{}',
  price_override numeric,
  units_per_run  integer not null default 1,
  quantity_tiers jsonb not null default '[1,3,5,10]',
  result_cost    numeric,
  result_price   numeric,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.pricing_sessions enable row level security;

create policy "Users manage own pricing sessions"
  on public.pricing_sessions for all using (auth.uid() = user_id);

create index on public.pricing_sessions (user_id, created_at desc);
