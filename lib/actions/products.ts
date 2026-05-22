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
  plates_per_unit?: boolean
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
  // Daily-rate mode (primary)
  dailyRate?: number          // target revenue per active day ($)
  workingHoursPerDay?: number // active print hours per day
  failureRate: number         // material waste % (applied to filament only)
  defaultSpoolPrice: number
  defaultSpoolWeight: number
  // Legacy/fallback params (used when dailyRate is not provided)
  printerWatts?: number
  electricityCost?: number
  hourlyRate?: number
  marginPct?: number
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

  // Fetch all printers for per-printer specs
  const { data: printers } = await supabase
    .from('user_printers')
    .select('id, watts, purchase_value, lifespan_hours, long_print_tiers, daily_rate, working_hours_per_day')
    .eq('user_id', user.id)

  type PrinterSpec = {
    watts: number; cph: number
    dailyRate: number; workingHours: number
    tiers: { min_hours: number; min_margin_pct: number }[]
  }
  const printerMap: Record<string, PrinterSpec> = {}
  for (const pr of (printers ?? [])) {
    const cph = (pr.purchase_value && pr.lifespan_hours) ? pr.purchase_value / pr.lifespan_hours : 0
    printerMap[pr.id] = {
      watts:        Number(pr.watts ?? 120),
      cph,
      dailyRate:    Number(pr.daily_rate ?? 0),
      workingHours: Number(pr.working_hours_per_day ?? 20),
      tiers:        Array.isArray(pr.long_print_tiers) ? pr.long_print_tiers : [],
    }
  }

  const {
    failureRate, defaultSpoolPrice, defaultSpoolWeight,
    dailyRate: globalDailyRate, workingHoursPerDay: globalWorkingHours,
    printerWatts = 120, electricityCost = 0.15, hourlyRate = 0, marginPct = 40,
    longPrintTiers,
  } = params

  const useDailyRate = (globalDailyRate ?? 0) > 0

  const updates = products.map(p => {
    const weightG      = Number(p.weight_g    ?? 0)
    const printHours   = Number(p.print_hours  ?? 0)
    const printerCount = Number(p.printer_count ?? 1)
    const spec         = p.printer_id ? printerMap[p.printer_id] : null

    // Filament cost — real out-of-pocket material cost, with failure buffer
    const filamentRaw  = weightG * (defaultSpoolPrice / Math.max(defaultSpoolWeight, 1))
    const filamentCost = filamentRaw * (1 + failureRate / 100)

    let costUSD: number
    let priceUSD: number

    if (useDailyRate) {
      // ── Daily-rate model ──────────────────────────────────────
      // Use linked printer's daily rate if available, else global
      const dr  = (spec?.dailyRate  ?? 0) > 0 ? spec!.dailyRate  : (globalDailyRate  ?? 0)
      const wh  = (spec?.workingHours ?? 0) > 0 ? spec!.workingHours : (globalWorkingHours ?? 20)
      const effectiveRate = dr / Math.max(wh, 1)  // $/h

      // Machine time scales with parallel printers (more machines = more cost)
      const machineContribution = printHours * effectiveRate * printerCount

      costUSD  = parseFloat(filamentCost.toFixed(4))
      priceUSD = parseFloat((filamentCost + machineContribution).toFixed(2))
    } else {
      // ── Legacy model (amort + energy + margin) ────────────────
      const watts = spec?.watts ?? printerWatts
      const cph   = spec?.cph   ?? hourlyRate

      const energy   = printHours * (watts / 1000) * electricityCost * printerCount
      const amort    = printHours * cph * printerCount
      const subtotal = (filamentRaw + energy + amort) * (1 + failureRate / 100)
      costUSD        = parseFloat(subtotal.toFixed(4))

      const effectiveHours = printHours / Math.max(printerCount, 1)
      const tiers = longPrintTiers
        ?? (spec?.tiers?.length
          ? spec.tiers.map(t => ({ minHours: t.min_hours, minMarginPct: t.min_margin_pct }))
          : [{ minHours: 0, minMarginPct: marginPct }])

      const sorted = [...tiers].sort((a, b) => b.minHours - a.minHours)
      const active  = sorted.find(t => effectiveHours >= t.minHours)
      const margin  = Math.max(marginPct, active?.minMarginPct ?? marginPct)

      priceUSD = margin >= 100
        ? parseFloat((subtotal * 2).toFixed(2))
        : parseFloat((subtotal / (1 - margin / 100)).toFixed(2))
    }

    return { id: p.id, cost_usd: costUSD, price_usd: priceUSD }
  })

  for (const u of updates) {
    await supabase.from('products').update({ cost_usd: u.cost_usd, price_usd: u.price_usd }).eq('id', u.id)
  }

  revalidatePath('/produtos')
  revalidatePath('/printers')
  return updates.length
}
