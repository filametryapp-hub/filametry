'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function getCompanyId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', userId)
    .single()
  return data?.company_id ?? null
}

export async function getCashFlow(month?: number, year?: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const companyId = await getCompanyId(supabase, user.id)

  const now = new Date()
  const m = month ?? now.getMonth() + 1
  const y = year ?? now.getFullYear()

  const from = `${y}-${String(m).padStart(2, '0')}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const to = `${y}-${String(m).padStart(2, '0')}-${lastDay}`

  // Always query by user_id so entries with null company_id are always visible
  let q = supabase
    .from('cash_flow')
    .select('*')
    .eq('user_id', user.id)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: false })

  // If the user has a company, also accept entries tied to that company
  // (entries from other users in the same company)
  if (companyId) {
    q = supabase
      .from('cash_flow')
      .select('*')
      .eq('company_id', companyId)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: false })
  }

  const { data, error } = await q
  if (error) { console.error('[getCashFlow] error:', error); return [] }
  return data ?? []
}

export async function getCashFlowSummary() {
  const entries = await getCashFlow()

  let income = 0
  let expenses = 0
  for (const entry of entries) {
    if (entry.type === 'income') income += Number(entry.amount)
    else expenses += Number(entry.amount)
  }
  return { income, expenses, balance: income - expenses }
}

export async function addCashFlowEntry(entry: {
  type: string
  category: string
  description: string
  amount: number
  date: string
  reference_id?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const companyId = await getCompanyId(supabase, user.id)

  const { error } = await supabase
    .from('cash_flow')
    .insert({ ...entry, company_id: companyId ?? null, user_id: user.id })

  if (error) throw error
  revalidatePath('/cash-flow')
}
