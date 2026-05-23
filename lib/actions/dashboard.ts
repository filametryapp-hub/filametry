'use server'

import { createClient } from '@/lib/supabase/server'

export interface DashboardData {
  monthlyRevenue:  number
  monthlyExpenses: number
  activeOrders:    number
  activeQuotes:    number
  printerCount:    number
  filamentSpentKg: number
  chartDays:       { date: string; revenue: number; cost: number }[]
  recentOrders:    {
    id: string
    clientName: string
    productName: string
    amount: number
    status: string
    createdAt: string
  }[]
  filamentStock: {
    name: string
    colorHex: string
    remainingG: number
    totalG: number
  }[]
  companyName: string
  companyCity: string
}

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const empty: DashboardData = {
    monthlyRevenue: 0, monthlyExpenses: 0, activeOrders: 0, activeQuotes: 0,
    printerCount: 0, filamentSpentKg: 0, chartDays: [], recentOrders: [],
    filamentStock: [], companyName: '', companyCity: '',
  }
  if (!user) return empty

  // Company info
  const { data: profile } = await supabase
    .from('profiles').select('company_id').eq('id', user.id).single()
  const companyId = profile?.company_id ?? null

  const [company, orders, filaments, printers, quotes] = await Promise.all([
    companyId
      ? supabase.from('companies').select('name,city').eq('id', companyId).single().then(r => r.data)
      : null,
    supabase.from('orders').select('id,client_name,status,created_at,order_items(product_name,quantity,unit_price)')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(50).then(r => r.data ?? []),
    supabase.from('filaments').select('color,color_hex,brand,weight_g,remaining_g')
      .eq('user_id', user.id).then(r => r.data ?? []),
    supabase.from('printers').select('id').eq('user_id', user.id).then(r => r.data ?? []),
    supabase.from('quotes').select('id,status').eq('user_id', user.id).then(r => r.data ?? []),
  ])

  // Monthly cash flow from cash_flow table
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const fromDate = `${y}-${String(m).padStart(2, '0')}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const toDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const { data: cashFlow } = await supabase
    .from('cash_flow')
    .select('type,amount,date')
    .eq('user_id', user.id)
    .gte('date', fromDate).lte('date', toDate)

  let monthlyRevenue = 0; let monthlyExpenses = 0
  for (const e of cashFlow ?? []) {
    if (e.type === 'income') monthlyRevenue += Number(e.amount)
    else monthlyExpenses += Number(e.amount)
  }

  // 30-day chart data
  const d30ago = new Date(now)
  d30ago.setDate(now.getDate() - 29)
  const from30 = d30ago.toISOString().slice(0, 10)

  const { data: chartEntries } = await supabase
    .from('cash_flow').select('type,amount,date')
    .eq('user_id', user.id).gte('date', from30).lte('date', toDate)

  const dayMap: Record<string, { revenue: number; cost: number }> = {}
  for (let i = 0; i < 30; i++) {
    const d = new Date(d30ago); d.setDate(d30ago.getDate() + i)
    dayMap[d.toISOString().slice(0, 10)] = { revenue: 0, cost: 0 }
  }
  for (const e of chartEntries ?? []) {
    if (!dayMap[e.date]) continue
    if (e.type === 'income') dayMap[e.date].revenue += Number(e.amount)
    else dayMap[e.date].cost += Number(e.amount)
  }
  const chartDays = Object.entries(dayMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }))

  // Active orders (not done/cancelled)
  const activeOrders = (orders as { status: string }[]).filter(
    o => !['done', 'cancelled'].includes(o.status)
  ).length

  // Active quotes
  const activeQuotes = (quotes as { status: string }[]).filter(
    q => q.status !== 'rejected'
  ).length

  // Recent orders (last 5)
  const recentOrders = (orders as {
    id: string; client_name: string; status: string; created_at: string;
    order_items: { product_name: string; quantity: number; unit_price: number }[]
  }[])
    .slice(0, 5)
    .map(o => {
      const amount = o.order_items.reduce((s, i) => s + i.quantity * i.unit_price, 0)
      const productName = o.order_items[0]?.product_name ?? '—'
      return { id: o.id, clientName: o.client_name, productName, amount, status: o.status, createdAt: o.created_at }
    })

  // Filament stock — top 5 by remaining
  const filamentStock = (filaments as { color: string; color_hex: string; brand: string; weight_g: number; remaining_g: number }[])
    .sort((a, b) => b.remaining_g - a.remaining_g)
    .slice(0, 6)
    .map(f => ({
      name: `${f.color}`,
      colorHex: f.color_hex ?? '#aaa',
      remainingG: f.remaining_g,
      totalG: f.weight_g,
    }))

  // Filament spent: sum of (weight_g - remaining_g)
  const filamentSpentG = (filaments as { weight_g: number; remaining_g: number }[])
    .reduce((s, f) => s + Math.max(0, f.weight_g - f.remaining_g), 0)

  return {
    monthlyRevenue,
    monthlyExpenses,
    activeOrders,
    activeQuotes,
    printerCount: printers.length,
    filamentSpentKg: filamentSpentG / 1000,
    chartDays,
    recentOrders,
    filamentStock,
    companyName: (company as { name?: string } | null)?.name ?? '',
    companyCity:  (company as { city?: string } | null)?.city  ?? '',
  }
}
