'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getOrders() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[getOrders] Supabase error:', error)
      return []
    }
    return data ?? []
  } catch (e) {
    console.error('[getOrders] unexpected error:', e)
    return []
  }
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
  tip?: number
  payment_method?: string
  items: Array<{
    product_id?: string
    product_name: string
    quantity: number
    unit_price: number
  }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Base fields (always exist)
  const baseFields = {
    client_name:            order.client_name,
    client_email:           order.client_email ?? null,
    notes:                  order.notes ?? null,
    quote_tiers:            order.quote_tiers ?? null,
    show_discount_on_print: order.show_discount_on_print ?? false,
    updated_at:             new Date().toISOString(),
  }

  // Try full update first (with new optional columns tip/payment_method)
  const result1 = await supabase.from('orders').update({
    ...baseFields,
    tip:            order.tip ?? 0,
    payment_method: order.payment_method ?? null,
  }).eq('id', id)

  // Fallback: if columns don't exist yet (migration pending), retry base only
  if (result1.error) {
    const result2 = await supabase.from('orders').update(baseFields).eq('id', id)
    if (result2.error) throw result2.error
  }

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

  // If order is done, sync the cash flow entry amount (tip may have changed)
  if (user) {
    const { data: existing } = await supabase
      .from('cash_flow').select('id').eq('reference_id', id).eq('type', 'income').maybeSingle()

    if (existing) {
      const { data: ord } = await supabase
        .from('orders').select('*, order_items(*)').eq('id', id).single()

      if (ord && ord.status === 'done') {
        const itemsTotal = (ord.order_items ?? []).reduce(
          (s: number, i: { quantity: number; unit_price: number }) => s + i.quantity * i.unit_price, 0
        )
        const discount  = itemsTotal * ((ord.discount_pct ?? 0) / 100)
        const baseTotal = ord.total ?? (itemsTotal - discount + (ord.shipping ?? 0))
        const newAmount = parseFloat((baseTotal + (order.tip ?? 0)).toFixed(2))
        await supabase.from('cash_flow').update({ amount: newAmount }).eq('id', existing.id)
      }
    }
  }

  revalidatePath('/pedidos')
  revalidatePath('/cash-flow')
}

export async function updateOrderStatus(id: string, status: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', id)

  if (error) throw error

  // When order is completed → cash flow + filament deduction + product stock deduction
  if (status === 'done' && user) {
    const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
    const companyId = profile?.company_id ?? null

    const { data: order } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', id)
      .single()

    if (order) {
      // ── 1. Cash flow income entry ──────────────────────────────
      const itemsTotal = (order.order_items ?? []).reduce(
        (s: number, i: { quantity: number; unit_price: number }) => s + i.quantity * i.unit_price, 0
      )
      const discount    = itemsTotal * ((order.discount_pct ?? 0) / 100)
      const baseTotal   = order.total ?? (itemsTotal - discount + (order.shipping ?? 0))
      const tip         = Number(order.tip ?? 0)
      const total       = baseTotal + tip
      const method      = order.payment_method ?? ''
      const desc        = `${order.client_name}${method ? ` · ${method.toUpperCase()}` : ''}${tip > 0 ? ' · +tip' : ''}`

      const { data: existing } = await supabase
        .from('cash_flow').select('id').eq('reference_id', id).eq('type', 'income').maybeSingle()

      if (!existing && total > 0) {
        await supabase.from('cash_flow').insert({
          user_id:      user.id,
          company_id:   companyId ?? null,
          type:         'income',
          category:     'order',
          description:  desc,
          amount:       parseFloat(total.toFixed(2)),
          date:         new Date().toISOString().slice(0, 10),
          reference_id: id,
        })
      }

      // ── 2. Filament stock deduction ────────────────────────────
      // For each item that has a product_id, look up weight_g & material
      const productIds = (order.order_items ?? [])
        .filter((i: { product_id?: string | null }) => i.product_id)
        .map((i: { product_id: string }) => i.product_id)

      if (productIds.length > 0) {
        const { data: products } = await supabase
          .from('products')
          .select('id, weight_g, material')
          .in('id', productIds)

        // Fetch all spools sorted by remaining (fullest first)
        const { data: spools } = await supabase
          .from('filaments')
          .select('id, material, remaining_g')
          .order('remaining_g', { ascending: false })

        for (const item of (order.order_items ?? [])) {
          const itm = item as { product_id?: string | null; quantity: number }
          if (!itm.product_id) continue
          const prod = (products ?? []).find((p: { id: string }) => p.id === itm.product_id) as
            { id: string; weight_g: number; material: string } | undefined
          if (!prod) continue

          const totalG = prod.weight_g * itm.quantity

          // Find best-matching spool (material contains product material, has enough)
          const mat = prod.material.toLowerCase().split('/')[0].trim()
          const spool = (spools ?? []).find((s: { id: string; material: string; remaining_g: number }) =>
            s.material.toLowerCase().includes(mat) && Number(s.remaining_g) >= totalG
          ) ?? (spools ?? []).find((s: { id: string; material: string; remaining_g: number }) =>
            s.material.toLowerCase().includes(mat)
          )

          if (spool) {
            const newRemaining = Math.max(0, Number(spool.remaining_g) - totalG)
            await supabase.from('filaments').update({ remaining_g: newRemaining }).eq('id', spool.id)
            // Update local cache so next iteration sees updated value
            ;(spool as { remaining_g: number }).remaining_g = newRemaining
          }
        }
      }

      // ── 3. Product stock deduction ─────────────────────────────
      for (const item of (order.order_items ?? [])) {
        const itm = item as { product_id?: string | null; quantity: number }
        if (!itm.product_id) continue
        const { data: p } = await supabase.from('products').select('stock_qty').eq('id', itm.product_id).single()
        if (p) {
          const newQty = Math.max(0, Number(p.stock_qty ?? 0) - itm.quantity)
          await supabase.from('products').update({ stock_qty: newQty }).eq('id', itm.product_id)
        }
      }
    }
  }

  revalidatePath('/pedidos')
  revalidatePath('/production')
  revalidatePath('/cash-flow')
  revalidatePath('/dashboard')
  revalidatePath('/filamentos')
  revalidatePath('/produtos')
}

export async function deleteOrder(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('orders').delete().eq('id', id)
  if (error) throw error
  revalidatePath('/pedidos')
}
