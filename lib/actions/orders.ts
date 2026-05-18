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

export async function createOrder(order: {
  client_name: string
  client_email?: string
  notes?: string
  quote_tiers?: { qty: number; unit_price: number }[] | null
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
      user_id:      user.id,
      client_name:  order.client_name,
      client_email: order.client_email,
      notes:        order.notes,
      quote_tiers:  order.quote_tiers ?? null,
      status:       'draft',
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

export async function updateOrderStatus(id: string, status: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', id)

  if (error) throw error
  revalidatePath('/pedidos')
}

export async function deleteOrder(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('orders').delete().eq('id', id)
  if (error) throw error
  revalidatePath('/pedidos')
}
