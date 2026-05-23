'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getOrders() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function getOrderById(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function createOrder(order: {
  client_name: string
  client_email?: string
  notes?: string
  quote_tiers?: { qty: number; unit_price: number }[] | null
  show_discount_on_print?: boolean
  items: Array<{
    product_id?: string
    product_name: string
    quantity: number
    unit_price: number
  }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: newOrder, error: orderError } = await supabase
    .from('orders')
    .insert({
      user_id:               user.id,
      client_name:           order.client_name,
      client_email:          order.client_email,
      notes:                 order.notes,
      quote_tiers:           order.quote_tiers ?? null,
      show_discount_on_print: order.show_discount_on_print ?? false,
      status:                'draft',
    })
    .select()
    .single()

  if (orderError) throw orderError

  if (order.items.length > 0) {
    const { error: itemsError } = await supabase.from('order_items').insert(
      order.items.map(item => ({
        order_id:     newOrder.id,
        product_id:   item.product_id ?? null,
        product_name: item.product_name,
        quantity:     item.quantity,
        unit_price:   item.unit_price,
      }))
    )
    if (itemsError) throw itemsError
  }

  revalidatePath('/pedidos')
  return newOrder
}

export async function updateOrder(id: string, order: {
  client_name: string
  client_email?: string
  notes?: string
  quote_tiers?: { qty: number; unit_price: number }[] | null
  show_discount_on_print?: boolean
  items: Array<{
    product_id?: string
    product_name: string
    quantity: number
    unit_price: number
  }>
}) {
  const supabase = await createClient()

  const { error: orderError } = await supabase
    .from('orders')
    .update({
      client_name:            order.client_name,
      client_email:           order.client_email ?? null,
      notes:                  order.notes ?? null,
      quote_tiers:            order.quote_tiers ?? null,
      show_discount_on_print: order.show_discount_on_print ?? false,
      updated_at:             new Date().toISOString(),
    })
    .eq('id', id)

  if (orderError) throw orderError

  // Replace order items: delete existing, insert new
  await supabase.from('order_items').delete().eq('order_id', id)

  if (order.items.length > 0) {
    const { error: itemsError } = await supabase.from('order_items').insert(
      order.items.map(item => ({
        order_id:     id,
        product_id:   item.product_id ?? null,
        product_name: item.product_name,
        quantity:     item.quantity,
        unit_price:   item.unit_price,
      }))
    )
    if (itemsError) throw itemsError
  }

  revalidatePath('/pedidos')
}

export async function updateOrderStatus(id: string, status: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', id)

  if (error) throw error

  // When order is completed → auto-create cash flow income entry
  if (status === 'done' && user) {
    const { data: order } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', id)
      .single()

    if (order) {
      const itemsTotal = (order.order_items ?? []).reduce(
        (s: number, i: { quantity: number; unit_price: number }) => s + i.quantity * i.unit_price, 0
      )
      const discount  = itemsTotal * ((order.discount_pct ?? 0) / 100)
      const total     = order.total ?? (itemsTotal - discount + (order.shipping ?? 0))
      const method    = order.payment_method ?? ''
      const desc      = `${order.client_name}${method ? ` · ${method.toUpperCase()}` : ''}`

      // Avoid duplicate cash flow entries for the same order
      const { data: existing } = await supabase
        .from('cash_flow')
        .select('id')
        .eq('reference_id', id)
        .eq('type', 'income')
        .maybeSingle()

      if (!existing && total > 0) {
        await supabase.from('cash_flow').insert({
          user_id:      user.id,
          type:         'income',
          category:     'order',
          description:  desc,
          amount:       parseFloat(total.toFixed(2)),
          date:         new Date().toISOString().slice(0, 10),
          reference_id: id,
        })
      }
    }
  }

  revalidatePath('/pedidos')
  revalidatePath('/production')
  revalidatePath('/cash-flow')
  revalidatePath('/dashboard')
}

export async function deleteOrder(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('orders').delete().eq('id', id)
  if (error) throw error
  revalidatePath('/pedidos')
}
