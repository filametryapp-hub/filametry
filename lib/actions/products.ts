'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getProducts() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function upsertProduct(product: {
  id?: string
  name: string
  description?: string
  material: string
  weight_g: number
  print_hours: number
  cost_usd: number
  price_usd: number
  image_url?: string
  tags: string[]
  volume_prices?: { min_qty: number; price_usd: number }[] | null
  product_code?: string
  units_per_run?: number
  batches?: number | null
  status?: 'active' | 'failed' | 'test'
  printer_id?: string | null
  printer_count?: number
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Auto-generate code for new products
  let productCode = product.product_code
  if (!product.id && !productCode) {
    const { data: last } = await supabase
      .from('products')
      .select('product_code')
      .not('product_code', 'is', null)
      .order('product_code', { ascending: false })
      .limit(1)
      .single()
    const nextNum = last?.product_code ? parseInt(last.product_code, 10) + 1 : 1
    productCode = String(nextNum).padStart(3, '0')
  }

  const { error } = await supabase
    .from('products')
    .upsert({
      ...product,
      user_id: user.id,
      product_code: productCode,
    }, { onConflict: 'id' })

  if (error) throw error
  revalidatePath('/produtos')
}

export async function setProductStatus(id: string, status: 'active' | 'failed' | 'test') {
  const supabase = await createClient()
  const { error } = await supabase.from('products').update({ status }).eq('id', id)
  if (error) throw error
  revalidatePath('/produtos')
}

export async function deleteProduct(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) throw error
  revalidatePath('/produtos')
}

export async function recalculateProductCosts(params: {
  printerWatts: number
  electricityCost: number
  hourlyRate: number       // amortization $/h
  failureRate: number      // %
  marginPct: number        // %
  defaultSpoolPrice: number
  defaultSpoolWeight: number
  longPrintTiers?: { minHours: number; minMarginPct: number }[]
}): Promise<number> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: products, error } = await supabase
    .from('products')
    .select('id, weight_g, print_hours, price_usd, printer_id, printer_count')
    .eq('user_id', user.id)

  if (error) throw error
  if (!products || products.length === 0) return 0

  // Fetch all printers for per-printer specs lookup
  const { data: printers } = await supabase
    .from('user_printers')
    .select('id, watts, purchase_value, lifespan_hours, long_print_tiers')
    .eq('user_id', user.id)

  const printerMap: Record<string, { watts: number; cph: number; tiers: { min_hours: number; min_margin_pct: number }[] }> = {}
  for (const pr of (printers ?? [])) {
    const cph = (pr.purchase_value && pr.lifespan_hours) ? pr.purchase_value / pr.lifespan_hours : 0
    printerMap[pr.id] = {
      watts: Number(pr.watts ?? params.printerWatts),
      cph,
      tiers: Array.isArray(pr.long_print_tiers) ? pr.long_print_tiers : [],
    }
  }

  const {
    printerWatts, electricityCost, hourlyRate,
    failureRate, marginPct, defaultSpoolPrice, defaultSpoolWeight,
    longPrintTiers,
  } = params

  const updates = products.map(p => {
    const weightG      = Number(p.weight_g    ?? 0)
    const printHours   = Number(p.print_hours  ?? 0)
    const printerCount = Number(p.printer_count ?? 1)
    const printerSpec  = p.printer_id ? printerMap[p.printer_id] : null

    // Use linked printer's specs if available, else modal defaults
    const watts = printerSpec?.watts ?? printerWatts
    const cph   = printerSpec?.cph ?? hourlyRate

    // Energy and amort scale with number of parallel printers
    const filament = weightG * (defaultSpoolPrice / Math.max(defaultSpoolWeight, 1))
    const energy   = printHours * (watts / 1000) * electricityCost * printerCount
    const amort    = printHours * cph * printerCount
    const subtotal = (filament + energy + amort) * (1 + failureRate / 100)
    const costUSD  = parseFloat(subtotal.toFixed(4))

    // Effective hours = actual time the job takes (halved by parallel printers)
    const effectiveHours = printHours / Math.max(printerCount, 1)

    // Determine minimum margin from long-print tiers
    const tiers = longPrintTiers
      ?? (printerSpec?.tiers?.length
        ? printerSpec.tiers.map(t => ({ minHours: t.min_hours, minMarginPct: t.min_margin_pct }))
        : [{ minHours: 0, minMarginPct: marginPct }])

    const sortedTiers = [...tiers].sort((a, b) => b.minHours - a.minHours)
    const activeTier  = sortedTiers.find(t => effectiveHours >= t.minHours)
    const finalMargin = Math.max(marginPct, activeTier?.minMarginPct ?? marginPct)

    const priceUSD = finalMargin >= 100
      ? parseFloat((subtotal * 2).toFixed(2))
      : parseFloat((subtotal / (1 - finalMargin / 100)).toFixed(2))

    return { id: p.id, cost_usd: costUSD, price_usd: priceUSD }
  })

  // Batch update
  for (const u of updates) {
    await supabase.from('products').update({ cost_usd: u.cost_usd, price_usd: u.price_usd }).eq('id', u.id)
  }

  revalidatePath('/produtos')
  revalidatePath('/printers')
  return updates.length
}
