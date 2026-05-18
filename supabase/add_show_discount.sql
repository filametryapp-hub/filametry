-- Control whether the discount column appears when printing a quote
alter table public.orders
  add column if not exists show_discount_on_print boolean not null default false;
