-- Add quote_tiers to orders for multi-quantity quote proposals
-- Format: [{"qty": 10, "unit_price": 11.48}, {"qty": 20, "unit_price": 10.00}, ...]
alter table public.orders
  add column if not exists quote_tiers jsonb;
