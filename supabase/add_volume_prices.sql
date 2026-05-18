-- Add volume pricing tiers to products
-- Format: [{"min_qty": 1, "price_usd": 15.00}, {"min_qty": 5, "price_usd": 12.50}, ...]
alter table public.products
  add column if not exists volume_prices jsonb;
