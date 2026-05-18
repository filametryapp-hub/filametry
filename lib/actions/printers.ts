'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { TRIAL_PRINTER_LIMIT } from '@/lib/stripe/plans'
import { createExpense } from './expenses'

export type PrinterData = {
  name: string
  brand: string
  model: string
  watts: number
  build_volume_mm?: { x: number; y: number; z: number } | null
  is_default?: boolean
  purchase_value?: number
  purchase_date?: string
  lifespan_hours?: number
}

export async function getUserPrinters() {
  const supabase = await createClient()
  try {
    const { data, error } = await supabase
      .from('user_printers')
      .select('*, equipment_payments(*)')
      .order('created_at', { ascending: true })
    if (error) {
      // equipment_payments table may not exist yet — fall back
      const { data: simple } = await supabase
        .from('user_printers').select('*').order('created_at', { ascending: true })
      return (simple ?? []).map((p: Record<string, unknown>) => ({ ...p, equipment_payments: [] }))
    }
    return data
  } catch {
    return []
  }
}

export async function getPrinterCount(): Promise<number> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('user_printers')
    .select('*', { count: 'exact', head: true })

  if (error) throw error
  return count ?? 0
}

export async function addPrinter(data: PrinterData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('profiles')
    .select('printer_limit')
    .eq('id', user.id)
    .single()

  const limit: number = profile?.printer_limit ?? TRIAL_PRINTER_LIMIT
  const current = await getPrinterCount()

  if (current >= limit) {
    throw new Error(
      `You have reached your plan limit of ${limit} printer${limit !== 1 ? 's' : ''}. Upgrade your plan to add more.`
    )
  }

  const { data: printer, error } = await supabase
    .from('user_printers')
    .insert({ ...data, user_id: user.id })
    .select()
    .single()

  if (error) throw error

  // Auto-create expense for new equipment purchase
  if ((data.purchase_value ?? 0) > 0) {
    try {
      await createExpense({
        category: 'equipment',
        description: `${data.brand} ${data.model} — ${data.name}`,
        amount: data.purchase_value!,
        paid_at: data.purchase_date ?? new Date().toISOString().slice(0, 10),
      })
    } catch {
      // expense creation failure must not break printer save
    }
  }

  revalidatePath('/printers')
  revalidatePath('/expenses')
  revalidatePath('/cash-flow')
  return printer
}

export async function updatePrinter(id: string, data: Partial<PrinterData>) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('user_printers')
    .update(data)
    .eq('id', id)

  if (error) throw error
  revalidatePath('/printers')
}

export async function deletePrinter(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('user_printers')
    .delete()
    .eq('id', id)

  if (error) throw error
  revalidatePath('/printers')
}

// ── Equipment Payments ────────────────────────────────────────

export async function addEquipmentPayment(data: {
  printer_id: string
  payer_name: string
  amount_paid: number
  paid_at?: string
  notes?: string
}) {
  const supabase = await createClient()
  const { error } = await supabase.from('equipment_payments').insert(data)
  if (error) throw error
  revalidatePath('/printers')
}

export async function deleteEquipmentPayment(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('equipment_payments').delete().eq('id', id)
  if (error) throw error
  revalidatePath('/printers')
}

// ── Amortization data ─────────────────────────────────────────
// Returns total print_hours from the products catalog + per-printer amortization stats
export async function getAmortizationData() {
  const supabase = await createClient()

  // Sum of all product print_hours (hours the printer has been "used" for catalog products)
  const { data: products } = await supabase.from('products').select('print_hours')
  const totalProductHours = (products ?? []).reduce(
    (s: number, p: { print_hours: number | null }) => s + Number(p.print_hours ?? 0), 0
  )

  const { data: printers } = await supabase
    .from('user_printers')
    .select('id, name, brand, model, purchase_value, lifespan_hours')
    .order('created_at', { ascending: true })

  return {
    totalProductHours,
    printers: (printers ?? []).map((p: Record<string, unknown>) => {
      const purchaseValue  = Number(p.purchase_value ?? 0)
      const lifespanHours  = Number(p.lifespan_hours ?? 0)
      const hourlyRate     = lifespanHours > 0 ? purchaseValue / lifespanHours : 0
      const amortizedValue = Math.min(totalProductHours * hourlyRate, purchaseValue)
      const remaining      = Math.max(purchaseValue - amortizedValue, 0)
      const pct            = purchaseValue > 0 ? (amortizedValue / purchaseValue) * 100 : 0
      return {
        id: String(p.id),
        label: `${p.brand} ${p.model} — ${p.name}`,
        purchaseValue,
        lifespanHours,
        hourlyRate,
        amortizedValue,
        remaining,
        pct,
      }
    }),
  }
}

// ── Test prints / waste ───────────────────────────────────────
export async function getTestPrints() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('expenses')
    .select('id, description, amount, paid_at, notes')
    .eq('category', 'test_print')
    .order('paid_at', { ascending: false })
    .limit(50)

  return (data ?? []).map((e: Record<string, unknown>) => ({
    id: String(e.id),
    description: String(e.description ?? ''),
    amount: Number(e.amount),
    paid_at: String(e.paid_at ?? ''),
    notes: e.notes ? String(e.notes) : undefined,
  }))
}
