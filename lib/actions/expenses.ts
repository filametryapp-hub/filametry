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

export async function getExpenses(filters?: { category?: string; from?: string; to?: string }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const companyId = await getCompanyId(supabase, user.id)
  if (!companyId) return []

  let query = supabase
    .from('expenses')
    .select('*, suppliers(name)')
    .eq('company_id', companyId)
    .order('paid_at', { ascending: false })

  if (filters?.category) query = query.eq('category', filters.category)
  if (filters?.from) query = query.gte('paid_at', filters.from)
  if (filters?.to) query = query.lte('paid_at', filters.to)

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function createExpense(expense: {
  category: string
  description: string
  amount: number
  paid_at: string
  supplier_id?: string
  notes?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const companyId = await getCompanyId(supabase, user.id)
  if (!companyId) throw new Error('No company found')

  const { data: newExpense, error: expenseError } = await supabase
    .from('expenses')
    .insert({ ...expense, company_id: companyId, user_id: user.id })
    .select()
    .single()

  if (expenseError) throw expenseError

  // Also record in cash_flow
  const { error: cfError } = await supabase
    .from('cash_flow')
    .insert({
      company_id: companyId,
      user_id: user.id,
      type: 'expense',
      category: expense.category,
      description: expense.description,
      amount: expense.amount,
      date: expense.paid_at,
      reference_id: newExpense.id,
    })

  if (cfError) throw cfError

  revalidatePath('/expenses')
  revalidatePath('/cash-flow')
  return newExpense
}

export async function updateExpense(id: string, expense: {
  category?: string
  description?: string
  amount?: number
  paid_at?: string
  supplier_id?: string
  notes?: string
}) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('expenses')
    .update(expense)
    .eq('id', id)

  if (error) throw error
  revalidatePath('/expenses')
}

export async function deleteExpense(id: string) {
  const supabase = await createClient()

  // Remove related cash_flow entry
  await supabase.from('cash_flow').delete().eq('reference_id', id)

  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) throw error
  revalidatePath('/expenses')
  revalidatePath('/cash-flow')
}

export async function getExpenseSummary() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const companyId = await getCompanyId(supabase, user.id)
  if (!companyId) return []

  const now = new Date()
  const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const { data, error } = await supabase
    .from('expenses')
    .select('category, amount')
    .eq('company_id', companyId)
    .gte('paid_at', from)

  if (error) throw error

  const summary: Record<string, number> = {}
  for (const row of data ?? []) {
    summary[row.category] = (summary[row.category] ?? 0) + Number(row.amount)
  }
  return Object.entries(summary).map(([category, total]) => ({ category, total }))
}
