-- Product status: active (normal) | failed (tested, not approved)
alter table public.products
  add column if not exists status text not null default 'active';
