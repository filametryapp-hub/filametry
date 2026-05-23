'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ConsumableRow = {
  id: string
  name: string
  unit: string
  cost_per_unit: number
  notes?: string | null
  code?: string | null
  created_at: string
}

export type ProductConsumableRow = {
  id: string
  consumable_id: string
  quantity_per_unit: number
  consumable: ConsumableRow
}

// ── Catalog CRUD ───────────────────────────────────────────────

export async function getConsumables(): Promise<ConsumableRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('consumables')
    .select('*')
    .order('name')
  if (error) throw error
  return (data ?? []) as ConsumableRow[]
}

export async function addConsumable(input: {
  name: string
  unit: string
  cost_per_unit: number
  notes?: string
}): Promise<ConsumableRow> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Auto-generate code
  const { data: last } = await supabase
    .from('consumables')
    .select('code')
    .not('code', 'is', null)
    .order('code', { ascending: false })
    .limit(1)
    .single()
  const lastNum = last?.code ? parseInt(last.code.replace('PP-', ''), 10) : 0
  const code = `PP-${String((isNaN(lastNum) ? 0 : lastNum) + 1).padStart(3, '0')}`

  const { data, error } = await supabase
    .from('consumables')
    .insert({ ...input, code, user_id: user.id })
    .select()
    .single()
  if (error) throw error
  revalidatePath('/consumables')
  return data as ConsumableRow
}

export async function updateConsumable(id: string, input: {
  name?: string
  unit?: string
  cost_per_unit?: number
  notes?: string
}): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('consumables')
    .update(input)
    .eq('id', id)
  if (error) throw error
  revalidatePath('/consumables')
  revalidatePath('/produtos')
}

export async function deleteConsumable(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('consumables')
    .delete()
    .eq('id', id)
  if (error) throw error
  revalidatePath('/consumables')
}

// ── Per-product consumables ────────────────────────────────────

export async function getProductConsumables(productId: string): Promise<ProductConsumableRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('product_consumables')
    .select('id, consumable_id, quantity_per_unit, consumable:consumables(*)')
    .eq('product_id', productId)
  if (error) throw error
  return (data ?? []) as unknown as ProductConsumableRow[]
}

/** Replace all consumables for a product (upsert pattern) */
export async function setProductConsumables(
  productId: string,
  items: { consumable_id: string; quantity_per_unit: number }[]
): Promise<void> {
  const supabase = await createClient()

  // Delete existing
  const { error: delErr } = await supabase
    .from('product_consumables')
    .delete()
    .eq('product_id', productId)
  if (delErr) throw delErr

  // Insert new
  if (items.length > 0) {
    const { error: insErr } = await supabase
      .from('product_consumables')
      .insert(items.map(i => ({ ...i, product_id: productId })))
    if (insErr) throw insErr
  }

  revalidatePath('/produtos')
}

/**
 * Returns a map of product_id → total consumables cost per unit.
 * Used by product-list to show the full material cost.
 */
export async function getConsumablesCostMap(): Promise<Record<string, number>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return {}

  // Fetch all product_consumables joined with consumables for user's products
  const { data, error } = await supabase
    .from('product_consumables')
    .select('product_id, quantity_per_unit, consumable:consumables(cost_per_unit)')
    .in('product_id',
      (await supabase.from('products').select('id').eq('user_id', user.id)).data?.map(p => p.id) ?? []
    )
  if (error) return {}

  const map: Record<string, number> = {}
  for (const row of data ?? []) {
    const cost = Number(row.quantity_per_unit) * Number((row.consumable as unknown as { cost_per_unit: number }).cost_per_unit)
    map[row.product_id] = (map[row.product_id] ?? 0) + cost
  }
  return map
}
