'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ExpenseCategory = 'material' | 'post_processing' | 'equipment' | 'packaging' | 'other'

export async function getExpenses(filters?: { category?: string; from?: string; to?: string }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  let query = supabase
    .from('expenses')
    .select('*, suppliers(name)')
    .eq('user_id', user.id)
    .order('paid_at', { ascending: false })

  if (filters?.category) query = query.eq('category', filters.category)
  if (filters?.from) query = query.gte('paid_at', filters.from)
  if (filters?.to) query = query.lte('paid_at', filters.to)

  const { data, error } = await query
  if (error) { console.error('[getExpenses]', error); return [] }
  return data ?? []
}

export async function createExpense(expense: {
  category: string
  description: string
  amount: number
  paid_at: string
  payment_method?: string
  paid_by?: string        // 'company' | partner name
  supplier_id?: string
  notes?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: newExpense, error: expenseError } = await supabase
    .from('expenses')
    .insert({ ...expense, user_id: user.id })
    .select()
    .single()

  if (expenseError) {
    // Fallback: try without payment_method if column doesn't exist
    const { payment_method, ...base } = expense
    void payment_method
    const { data: fallback, error: fallbackErr } = await supabase
      .from('expenses')
      .insert({ ...base, user_id: user.id })
      .select()
      .single()
    if (fallbackErr) throw fallbackErr

    // Cash flow
    await supabase.from('cash_flow').insert({
      user_id:     user.id,
      type:        'expense',
      category:    expense.category,
      description: expense.description,
      amount:      expense.amount,
      date:        expense.paid_at,
      reference_id: fallback.id,
    })

    revalidatePath('/expenses')
    revalidatePath('/cash-flow')
    return fallback
  }

  // Cash flow entry (skip for test_print)
  if (expense.category !== 'test_print') {
    const cfRow: Record<string, unknown> = {
      user_id:      user.id,
      type:         'expense',
      category:     expense.category,
      description:  expense.description,
      amount:       expense.amount,
      date:         expense.paid_at,
    }
    try { cfRow.reference_id = newExpense.id } catch { /* optional */ }
    await supabase.from('cash_flow').insert(cfRow)
  }

  revalidatePath('/expenses')
  revalidatePath('/cash-flow')
  return newExpense
}

export async function updateExpense(id: string, expense: {
  category?: string
  description?: string
  amount?: number
  paid_at?: string
  payment_method?: string
  paid_by?: string
  supplier_id?: string | null
  notes?: string | null
}) {
  const supabase = await createClient()
  const { error } = await supabase.from('expenses').update(expense).eq('id', id)
  // Fallback without payment_method
  if (error) {
    const { payment_method, ...base } = expense
    void payment_method
    const { error: e2 } = await supabase.from('expenses').update(base).eq('id', id)
    if (e2) throw e2
  }

  // Sync cash_flow amount
  const { data: exp } = await supabase.from('expenses').select('*').eq('id', id).single()
  if (exp) {
    await supabase.from('cash_flow')
      .update({ amount: exp.amount, description: exp.description, date: exp.paid_at })
      .eq('reference_id', id)
  }

  revalidatePath('/expenses')
  revalidatePath('/cash-flow')
}

export async function deleteExpense(id: string) {
  const supabase = await createClient()
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

  const now = new Date()
  const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const { data, error } = await supabase
    .from('expenses')
    .select('category, amount')
    .eq('user_id', user.id)
    .gte('paid_at', from)

  if (error) return []

  const summary: Record<string, number> = {}
  for (const row of data ?? []) {
    summary[row.category] = (summary[row.category] ?? 0) + Number(row.amount)
  }
  return Object.entries(summary).map(([category, total]) => ({ category, total }))
}
