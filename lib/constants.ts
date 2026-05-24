/** Shared constants — safe to import from both client and server components */

export const PAYMENT_METHODS = [
  { value: 'pix',          label: 'PIX' },
  { value: 'card',         label: 'Credit card' },
  { value: 'debit',        label: 'Debit card' },
  { value: 'transfer',     label: 'Bank transfer' },
  { value: 'cash',         label: 'Cash' },
  { value: 'installments', label: 'Installments' },
  { value: 'other',        label: 'Other' },
] as const

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]['value']
