'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface SavedSession {
  id: string
  name: string
  batches: unknown
  shared: unknown
  price_override: number | null
  units_per_run: number
  quantity_tiers: number[]
  result_cost: number | null
  result_price: number | null
  created_at: string
  updated_at: string
}

export async function getPricingSessions(): Promise<SavedSession[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pricing_sessions')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(50)

  if (error) return []
  return (data ?? []) as SavedSession[]
}

export async function savePricingSession(session: {
  id?: string
  name: string
  batches: unknown
  shared: unknown
  price_override?: number | null
  units_per_run?: number
  quantity_tiers?: number[]
  result_cost?: number | null
  result_price?: number | null
}): Promise<SavedSession | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const payload = {
    name:           session.name,
    batches:        session.batches,
    shared:         session.shared,
    price_override: session.price_override ?? null,
    units_per_run:  session.units_per_run ?? 1,
    quantity_tiers: session.quantity_tiers ?? [1, 3, 5, 10],
    result_cost:    session.result_cost ?? null,
    result_price:   session.result_price ?? null,
    user_id:        user.id,
    updated_at:     new Date().toISOString(),
  }

  let result
  if (session.id) {
    // Update existing
    const { data, error } = await supabase
      .from('pricing_sessions')
      .update(payload)
      .eq('id', session.id)
      .eq('user_id', user.id)
      .select()
      .single()
    if (error) return null
    result = data
  } else {
    // Create new
    const { data, error } = await supabase
      .from('pricing_sessions')
      .insert(payload)
      .select()
      .single()
    if (error) return null
    result = data
  }

  revalidatePath('/precificacao')
  return result as SavedSession
}

export async function getPricingSession(id: string): Promise<SavedSession | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pricing_sessions')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !data) return null
  return data as SavedSession
}

export async function deletePricingSession(id: string): Promise<void> {
  const supabase = await createClient()
  await supabase.from('pricing_sessions').delete().eq('id', id)
  revalidatePath('/precificacao')
}

export async function renamePricingSession(id: string, name: string): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from('pricing_sessions')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', id)
  revalidatePath('/precificacao')
}
