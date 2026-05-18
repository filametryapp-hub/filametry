'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function getCtx() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
  if (!profile?.company_id) throw new Error('No company')
  return { supabase, user, companyId: profile.company_id }
}

// Total invested per partner (equipment + material payments)
export async function getPartnerInvestments() {
  const { supabase } = await getCtx()

  // Get all equipment payments for this user's printers
  const { data: printers } = await supabase.from('user_printers').select('id').order('created_at')
  const printerIds = (printers ?? []).map((p: { id: string }) => p.id)

  const { data: equipPay } = printerIds.length > 0
    ? await supabase.from('equipment_payments').select('payer_name, amount_paid, paid_at').in('printer_id', printerIds)
    : { data: [] }

  // Material payments
  const { data: materials } = await supabase.from('filaments').select('id').order('created_at')
  const materialIds = (materials ?? []).map((m: { id: string }) => m.id)

  const { data: matPay } = materialIds.length > 0
    ? await supabase.from('material_payments').select('payer_name, amount_paid, paid_at').in('material_id', materialIds)
    : { data: [] }

  // Aggregate by payer
  const map: Record<string, { equipment: number; materials: number; entries: { label: string; amount: number; date: string }[] }> = {}

  for (const p of (equipPay ?? [])) {
    if (!map[p.payer_name]) map[p.payer_name] = { equipment: 0, materials: 0, entries: [] }
    map[p.payer_name].equipment += Number(p.amount_paid)
    map[p.payer_name].entries.push({ label: 'Equipment', amount: Number(p.amount_paid), date: p.paid_at })
  }
  for (const p of (matPay ?? [])) {
    if (!map[p.payer_name]) map[p.payer_name] = { equipment: 0, materials: 0, entries: [] }
    map[p.payer_name].materials += Number(p.amount_paid)
    map[p.payer_name].entries.push({ label: 'Materials', amount: Number(p.amount_paid), date: p.paid_at })
  }

  return Object.entries(map).map(([name, v]) => ({
    name,
    equipment: v.equipment,
    materials: v.materials,
    total: v.equipment + v.materials,
    entries: v.entries,
  }))
}

export async function getDistributions() {
  const { supabase, companyId } = await getCtx()
  const { data, error } = await supabase
    .from('partner_distributions')
    .select('*')
    .eq('company_id', companyId)
    .order('distributed_at', { ascending: false })
  if (error) return []
  return data
}

export async function addDistribution(data: {
  partner_name: string
  amount: number
  distributed_at: string
  notes?: string
}) {
  const { supabase, companyId } = await getCtx()
  const { error } = await supabase.from('partner_distributions').insert({ ...data, company_id: companyId })
  if (error) throw error
  revalidatePath('/wallet')
}

export async function deleteDistribution(id: string) {
  const { supabase } = await getCtx()
  const { error } = await supabase.from('partner_distributions').delete().eq('id', id)
  if (error) throw error
  revalidatePath('/wallet')
}

// ── Asset Debt Summary ────────────────────────────────────────
// Calculates how much each partner SHOULD have paid (% of total assets)
// vs how much they ACTUALLY paid, showing the debt between partners.
export async function getAssetDebtSummary() {
  const { supabase, companyId } = await getCtx()

  // 1. Partners with percentages
  const { data: partners } = await supabase
    .from('company_partners')
    .select('name, percentage')
    .eq('company_id', companyId)

  if (!partners || partners.length === 0) return { totalAssets: 0, partners: [] }

  // 2. Actual payments (equipment + materials) — used as primary source of truth
  const { data: printers } = await supabase.from('user_printers').select('id, purchase_value')
  const printerIds = (printers ?? []).map((p: { id: string }) => p.id)

  const { data: equipPay } = printerIds.length > 0
    ? await supabase.from('equipment_payments').select('payer_name, amount_paid').in('printer_id', printerIds)
    : { data: [] }

  const { data: materials } = await supabase.from('filaments').select('id, price_usd')
  const materialIds = (materials ?? []).map((m: { id: string }) => m.id)

  let matPay: { payer_name: string; amount_paid: number }[] = []
  try {
    const { data } = materialIds.length > 0
      ? await supabase.from('material_payments').select('payer_name, amount_paid').in('material_id', materialIds)
      : { data: [] }
    matPay = data ?? []
  } catch { matPay = [] }

  // 3. Aggregate actual payments per partner
  const paidMap: Record<string, number> = {}
  for (const p of (equipPay ?? [])) {
    paidMap[p.payer_name] = (paidMap[p.payer_name] ?? 0) + Number(p.amount_paid)
  }
  for (const p of matPay) {
    paidMap[p.payer_name] = (paidMap[p.payer_name] ?? 0) + Number(p.amount_paid)
  }

  // 4. Total: prefer sum of all actual payments; fall back to declared asset values
  const totalActualPaid = Object.values(paidMap).reduce((s, v) => s + v, 0)
  const totalPrinterValue = (printers ?? []).reduce((s, p) => s + Number(p.purchase_value ?? 0), 0)
  const totalMaterialValue = (materials ?? []).reduce((s, m) => s + Number(m.price_usd ?? 0), 0)
  const totalDeclared = totalPrinterValue + totalMaterialValue

  // Use whichever is larger — handles cases where purchase_value wasn't set
  const totalAssets = Math.max(totalActualPaid, totalDeclared)

  if (totalAssets === 0) return { totalAssets: 0, partners: [] }

  // 5. Per-partner: expected vs actual → balance
  // balance > 0 → paid more than their share (others owe them)
  // balance < 0 → paid less than their share (they owe others)
  return {
    totalAssets,
    partners: partners.map(partner => {
      const expectedShare = totalAssets * (partner.percentage / 100)
      const actualPaid   = paidMap[partner.name] ?? 0
      const balance      = actualPaid - expectedShare
      return { name: partner.name, percentage: partner.percentage, expectedShare, actualPaid, balance }
    }),
  }
}

export async function getCompanyWalletSummary() {
  const { supabase, companyId } = await getCtx()

  // All cash flow
  const { data: cf } = await supabase.from('cash_flow').select('type, amount').eq('company_id', companyId)
  let totalRevenue = 0, totalExpenses = 0
  for (const e of (cf ?? [])) {
    if (e.type === 'income') totalRevenue += Number(e.amount)
    else totalExpenses += Number(e.amount)
  }

  // All distributions
  const { data: dist } = await supabase.from('partner_distributions').select('amount').eq('company_id', companyId)
  const totalDistributed = (dist ?? []).reduce((s: number, d: { amount: number }) => s + Number(d.amount), 0)

  // Monthly revenue avg (last 3 months)
  const now = new Date()
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().slice(0, 10)
  const { data: recent } = await supabase
    .from('cash_flow').select('amount').eq('company_id', companyId).eq('type', 'income').gte('date', threeMonthsAgo)
  const avgMonthlyRevenue = (recent ?? []).reduce((s: number, e: { amount: number }) => s + Number(e.amount), 0) / 3

  return {
    totalRevenue,
    totalExpenses,
    netBalance: totalRevenue - totalExpenses,
    totalDistributed,
    distributable: totalRevenue - totalExpenses - totalDistributed,
    avgMonthlyRevenue,
  }
}
