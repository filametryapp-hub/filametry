-- Track whether the printer purchase has been recorded as an expense
-- Prevents duplicate expense entries after page reload
alter table public.user_printers
  add column if not exists purchase_expense_recorded boolean not null default false;
