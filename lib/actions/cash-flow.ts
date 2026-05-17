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
  if (!companyId) return []

  const now = new Date()
  const m = month ?? now.getMonth() + 1
  const y = year ?? now.getFullYear()

  const from = `${y}-${String(m).padStart(2, '0')}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const to = `${y}-${String(m).padStart(2, '0')}-${lastDay}`

  const { data, error } = await supabase
    .from('cash_flow')
    .select('*')
    .eq('company_id', companyId)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: false })

  if (error) throw error
  return data
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
  if (!companyId) throw new Error('No company found')

  const { error } = await supabase
    .from('cash_flow')
    .insert({ ...entry, company_id: companyId, user_id: user.id })

  if (error) throw error
  revalidatePath('/cash-flow')
}
