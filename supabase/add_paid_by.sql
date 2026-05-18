-- Add paid_by column to expenses table
-- Values: 'company' (pela empresa) | 'partner' (pelo sócio)
alter table public.expenses
  add column if not exists paid_by text not null default 'company';
