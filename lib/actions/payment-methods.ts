'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { PAYMENT_METHODS } from '@/lib/constants'

export type PaymentMethodRow = {
  id: string
  label: string
}

/** Returns user's custom payment methods. Falls back to hardcoded defaults if none saved yet. */
export async function getPaymentMethods(): Promise<PaymentMethodRow[]> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return PAYMENT_METHODS.map((m, i) => ({ id: String(i), label: m.label }))

    const { data, error } = await supabase
      .from('payment_methods')
      .select('id, label')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (error || !data) {
      return PAYMENT_METHODS.map((m, i) => ({ id: String(i), label: m.label }))
    }

    // If user has no custom methods yet, return hardcoded defaults
    if (data.length === 0) {
      return PAYMENT_METHODS.map((m, i) => ({ id: String(i), label: m.label }))
    }

    return data as PaymentMethodRow[]
  } catch {
    return PAYMENT_METHODS.map((m, i) => ({ id: String(i), label: m.label }))
  }
}

export async function addPaymentMethod(label: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const trimmed = label.trim()
  if (!trimmed) throw new Error('Label is required')

  const { error } = await supabase
    .from('payment_methods')
    .insert({ user_id: user.id, label: trimmed })

  if (error) throw error
  revalidatePath('/settings')
}

export async function updatePaymentMethod(id: string, label: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const trimmed = label.trim()
  if (!trimmed) throw new Error('Label is required')

  const { error } = await supabase
    .from('payment_methods')
    .update({ label: trimmed })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw error
  revalidatePath('/settings')
}

export async function deletePaymentMethod(id: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('payment_methods')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw error
  revalidatePath('/settings')
}

/** Seed the hardcoded defaults into DB so user can manage them. Only called once. */
export async function seedDefaultPaymentMethods(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: existing } = await supabase
    .from('payment_methods')
    .select('id')
    .eq('user_id', user.id)
    .limit(1)

  if (existing && existing.length > 0) return // already seeded

  const rows = PAYMENT_METHODS.map(m => ({ user_id: user.id, label: m.label }))
  await supabase.from('payment_methods').insert(rows)
  revalidatePath('/settings')
}
