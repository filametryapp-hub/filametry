'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type QuoteItem = {
  product_name: string
  qty: number
  unit_price: number
}

export type QuoteData = {
  company_name?: string
  company_email?: string
  company_phone?: string
  client_name: string
  client_address?: string
  items: QuoteItem[]
  discount_pct?: number
  shipping?: number
  packaging?: number
  delivery_days?: number
  notes?: string
  valid_days?: number
  status?: 'draft' | 'sent' | 'accepted' | 'rejected'
}

export type Quote = QuoteData & {
  id: string
  user_id: string
  total: number
  created_at: string
}

export async function getQuotes(): Promise<Quote[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('quotes')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (data ?? []) as Quote[]
}

export async function upsertQuote(id: string | null, payload: QuoteData): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Compute total
  const subtotal = payload.items.reduce((s, i) => s + i.qty * i.unit_price, 0)
  const discount = subtotal * ((payload.discount_pct ?? 0) / 100)
  const total = subtotal - discount + (payload.shipping ?? 0) + (payload.packaging ?? 0)

  const row = { ...payload, user_id: user.id, total: parseFloat(total.toFixed(2)) }

  if (id) {
    const { error } = await supabase.from('quotes').update(row).eq('id', id).eq('user_id', user.id)
    if (error) throw error
    revalidatePath('/quotes')
    return id
  } else {
    const { data, error } = await supabase.from('quotes').insert(row).select('id').single()
    if (error) throw error
    revalidatePath('/quotes')
    return (data as { id: string }).id
  }
}

export async function deleteQuote(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('quotes').delete().eq('id', id)
  if (error) throw error
  revalidatePath('/quotes')
}
