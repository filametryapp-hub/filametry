-- ============================================================
-- Filametry — Equipment value + amortization migration
-- Run in Supabase SQL Editor
-- ============================================================

-- Add financial fields to user_printers
ALTER TABLE public.user_printers
  ADD COLUMN IF NOT EXISTS purchase_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS purchase_date  date,
  ADD COLUMN IF NOT EXISTS lifespan_hours integer NOT NULL DEFAULT 5000;

-- Equipment payments (tracks who paid for each printer)
CREATE TABLE IF NOT EXISTS public.equipment_payments (
  id          uuid primary key default uuid_generate_v4(),
  printer_id  uuid NOT NULL REFERENCES public.user_printers(id) ON DELETE CASCADE,
  payer_name  text NOT NULL,
  amount_paid numeric NOT NULL CHECK (amount_paid >= 0),
  paid_at     date NOT NULL DEFAULT current_date,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.equipment_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own equipment payments"
  ON public.equipment_payments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_printers
      WHERE id = equipment_payments.printer_id
        AND user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_equip_pay_printer ON public.equipment_payments (printer_id);
