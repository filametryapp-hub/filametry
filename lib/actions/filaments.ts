'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createExpense } from './expenses'

export async function getFilaments() {
  const supabase = await createClient()
  try {
    const { data, error } = await supabase
      .from('filaments')
      .select('*, material_payments(*)')
      .order('created_at', { ascending: false })

    if (error) {
      // material_payments table may not exist yet — fall back
      const { data: simple } = await supabase
        .from('filaments').select('*').order('created_at', { ascending: false })
      return (simple ?? []).map((m: Record<string, unknown>) => ({ ...m, material_payments: [] }))
    }
    return data
  } catch {
    return []
  }
}

export async function upsertFilament(filament: {
  id?: string
  brand: string
  material: string
  color: string
  color_hex: string
  weight_g: number
  remaining_g: number
  price_usd: number
  purchased_at?: string
  notes?: string
  category?: string
  unit?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const isNew = !filament.id || filament.id === ''

  const { error } = await supabase
    .from('filaments')
    .upsert({ ...filament, user_id: user.id }, { onConflict: 'id' })

  if (error) throw error

  // Auto-create expense only for new items
  if (isNew && filament.price_usd > 0) {
    try {
      const description = `${filament.brand} ${filament.color}${filament.material ? ` (${filament.material})` : ''}`
      await createExpense({
        category: 'material',
        description,
        amount: filament.price_usd,
        paid_at: filament.purchased_at ?? new Date().toISOString().slice(0, 10),
      })
    } catch {
      // expense creation failure must not break material save
    }
  }

  revalidatePath('/filamentos')
  revalidatePath('/expenses')
  revalidatePath('/cash-flow')
}

export async function deleteFilament(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('filaments').delete().eq('id', id)
  if (error) throw error
  revalidatePath('/filamentos')
}

// ── Material Payments ─────────────────────────────────────────

export async function addMaterialPayment(data: {
  material_id: string
  payer_name: string
  amount_paid: number
  paid_at?: string
  notes?: string
}) {
  const supabase = await createClient()
  const { error } = await supabase.from('material_payments').insert(data)
  if (error) throw error
  revalidatePath('/filamentos')
}

export async function deleteMaterialPayment(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('material_payments').delete().eq('id', id)
  if (error) throw error
  revalidatePath('/filamentos')
}
