'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getPricingSession } from '@/lib/actions/pricing-sessions'

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
      const desc        = `${order.client_name}${method ? ` · ${method}` : ''}${tip > 0 ? ' · +gorjeta' : ''}`

      console.log('[updateOrderStatus] total:', total, 'items:', order.order_items?.length, 'baseTotal:', baseTotal, 'tip:', tip)

      // Check for existing entry by user_id (works even without reference_id column)
      const { data: existingByRef } = await supabase
        .from('cash_flow').select('id').eq('user_id', user.id).eq('reference_id', id).eq('type', 'income').maybeSingle()

      // Fallback: also check by description if reference_id column doesn't exist
      const { data: existingByDesc } = existingByRef ? { data: null } : await supabase
        .from('cash_flow').select('id').eq('user_id', user.id).eq('description', desc).eq('type', 'income').maybeSingle()

      const existing = existingByRef ?? existingByDesc

      if (!existing && total > 0) {
        const insertPayload: Record<string, unknown> = {
          user_id:     user.id,
          type:        'income',
          category:    'order',
          description: desc,
          amount:      parseFloat(total.toFixed(2)),
          date:        new Date().toISOString().slice(0, 10),
        }
        // Include optional columns only if they exist (graceful)
        if (companyId) insertPayload.company_id = companyId
        try { insertPayload.reference_id = id } catch { /* column may not exist */ }

        const { error: cfError } = await supabase.from('cash_flow').insert(insertPayload)
        if (cfError) console.error('[updateOrderStatus] cash_flow insert error:', cfError)
        else console.log('[updateOrderStatus] cash_flow entry created ✓')
      } else {
        console.log('[updateOrderStatus] cash_flow entry already exists or total=0, skipping')
      }

      // ── 2. Filament stock deduction ────────────────────────────
      const allItems = (order.order_items ?? []) as Array<{
        product_id?: string | null
        product_name?: string
        quantity: number
      }>

      const productIds = allItems.filter(i => i.product_id).map(i => i.product_id as string)
      const productNames = allItems.filter(i => !i.product_id && i.product_name).map(i => i.product_name as string)

      if (allItems.length > 0) {
        type FilamentColor = { color: string; type: string; weightG: number; spoolId?: string }
        type ProductRow = { id: string; name: string; weight_g: number; material: string; pricing_session_id?: string | null; filament_colors?: FilamentColor[] | null }
        type SpoolRow   = { id: string; material: string; remaining_g: number }
        type BatchFilament = { catalogSpoolId?: string; weightG: number; type: string }
        type Batch = { filaments: BatchFilament[] }

        // Load products (include filament_colors for direct deduction)
        const { data: productsByIdRaw } = productIds.length > 0
          ? await supabase.from('products').select('id, name, weight_g, material, pricing_session_id, filament_colors').eq('user_id', user.id).in('id', productIds)
          : { data: [] }
        const { data: productsByNameRaw } = productNames.length > 0
          ? await supabase.from('products').select('id, name, weight_g, material, pricing_session_id, filament_colors').eq('user_id', user.id)
          : { data: [] }

        const productsById   = (productsByIdRaw   ?? []) as ProductRow[]
        const productsByName = (productsByNameRaw ?? []) as ProductRow[]

        // All spools in memory (updated after each deduction)
        const { data: spoolsRaw } = await supabase
          .from('filaments').select('id, material, remaining_g').eq('user_id', user.id)
          .order('remaining_g', { ascending: false })
        const spools = (spoolsRaw ?? []) as SpoolRow[]

        async function deductFromSpool(spoolId: string, grams: number) {
          const spool = spools.find(s => s.id === spoolId)
          if (!spool) return
          const newRemaining = Math.max(0, Number(spool.remaining_g) - grams)
          await supabase.from('filaments').update({ remaining_g: newRemaining }).eq('id', spoolId)
          spool.remaining_g = newRemaining
          console.log('[deduction] spool', spoolId, '-', grams, 'g → remaining:', newRemaining)
        }

        async function deductByMaterial(mat: string, grams: number) {
          const key = mat.toLowerCase().split('/')[0].trim()
          const spool = spools.find(s => s.material.toLowerCase().includes(key) && Number(s.remaining_g) >= grams)
            ?? spools.find(s => s.material.toLowerCase().includes(key))
          if (spool) await deductFromSpool(spool.id, grams)
          else console.log('[deduction] no spool found for material:', key)
        }

        for (const item of allItems) {
          let prod: ProductRow | undefined

          if (item.product_id) {
            prod = productsById.find(p => p.id === item.product_id)
          } else if (item.product_name) {
            const needle = item.product_name.toLowerCase()
            prod = productsByName.find(p => p.name.toLowerCase().includes(needle))
              ?? productsByName.find(p => needle.includes(p.name.toLowerCase()))
          }

          if (!prod) {
            console.log('[deduction] no product match for:', item.product_name ?? item.product_id)
            continue
          }

          const qty = item.quantity

          // ── 1st choice: filament_colors saved on product (most reliable) ──
          if (prod.filament_colors && prod.filament_colors.length > 0) {
            for (const fil of prod.filament_colors) {
              const grams = fil.weightG * qty
              if (grams <= 0) continue
              if (fil.spoolId) {
                await deductFromSpool(fil.spoolId, grams)
              } else {
                await deductByMaterial(fil.type, grams)
              }
            }
            console.log('[deduction] used filament_colors for', prod.name, '—', prod.filament_colors.length, 'filaments')
            continue
          }

          // ── 2nd choice: pricing session batches ──
          if (prod.pricing_session_id) {
            const session = await getPricingSession(prod.pricing_session_id)
            const batches = session?.batches as Batch[] | undefined
            if (batches && batches.length > 0) {
              for (const batch of batches) {
                for (const fil of batch.filaments) {
                  const grams = fil.weightG * qty
                  if (grams <= 0) continue
                  if (fil.catalogSpoolId) await deductFromSpool(fil.catalogSpoolId, grams)
                  else await deductByMaterial(fil.type, grams)
                }
              }
              console.log('[deduction] used session', prod.pricing_session_id, 'for', prod.name)
              continue
            }
          }

          // ── Fallback: single material from product weight_g ──
          if (!prod.weight_g) {
            console.log('[deduction] product has no weight_g:', prod.name)
            continue
          }
          await deductByMaterial(prod.material, prod.weight_g * qty)
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
