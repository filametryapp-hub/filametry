'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type QuoteItem = {
  product_name: string
  qty: number
  unit_price: number
}

export type QuoteTier = {
  qty: number
  unitPrice: number
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
  volume_tiers?: QuoteTier[]
  show_discount_on_print?: boolean
  payment_method?: string
}

export type Quote = QuoteData & {
  id: string
  user_id: string
  total: number
  created_at: string
}

export async function getQuotes(): Promise<Quote[]> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
      .from('quotes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[getQuotes] Supabase error:', error)
      return []
    }
    return (data ?? []) as Quote[]
  } catch (e) {
    console.error('[getQuotes] unexpected error:', e)
    return []
  }
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

/** Convert an accepted quote into an order. Returns the new order id. */
export async function convertQuoteToOrder(quoteId: string): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Load quote
  const { data: q, error } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', quoteId)
    .single()
  if (error || !q) throw new Error('Quote not found')

  const quote = q as Quote

  // Compute totals from quote
  const subtotal     = (quote.items as QuoteItem[]).reduce((s, i) => s + i.qty * i.unit_price, 0)
  const discountAmt  = subtotal * ((quote.discount_pct ?? 0) / 100)
  const orderTotal   = subtotal - discountAmt + (quote.shipping ?? 0) + (quote.packaging ?? 0)

  // Create order carrying financial & payment details from quote
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({
      user_id:        user.id,
      client_name:    quote.client_name,
      client_email:   quote.company_email ?? null,
      notes:          quote.notes ?? null,
      status:         'accepted',
      payment_method: quote.payment_method ?? null,
      shipping:       quote.shipping ?? 0,
      discount_pct:   quote.discount_pct ?? 0,
      total:          parseFloat(orderTotal.toFixed(2)),
    })
    .select()
    .single()
  if (orderErr) throw orderErr

  // Insert order items
  const items = (quote.items as QuoteItem[]).map(i => ({
    order_id:     order.id,
    product_name: i.product_name,
    quantity:     i.qty,
    unit_price:   i.unit_price,
  }))
  if (items.length > 0) {
    const { error: itemsErr } = await supabase.from('order_items').insert(items)
    if (itemsErr) throw itemsErr
  }

  // Mark quote as converted
  await supabase.from('quotes').update({ status: 'accepted', notes: (quote.notes ? quote.notes + '\n' : '') + `[order:${order.id}]` }).eq('id', quoteId)

  revalidatePath('/pedidos')
  revalidatePath('/quotes')
  return order.id
}
