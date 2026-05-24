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

export async function getSuppliers() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const companyId = await getCompanyId(supabase, user.id)
  if (!companyId) return []

  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('company_id', companyId)
    .order('name', { ascending: true })

  if (error) throw error
  return data
}

export async function upsertSupplier(supplier: {
  id?: string
  name: string
  contact_name?: string
  email?: string
  phone?: string
  document?: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
  country?: string
  website?: string
  notes?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const companyId = await getCompanyId(supabase, user.id)
  if (!companyId) throw new Error('No company found')

  const { error } = await supabase
    .from('suppliers')
    .upsert({ ...supplier, company_id: companyId }, { onConflict: 'id' })

  if (error) throw error
  revalidatePath('/suppliers')
}

export async function deleteSupplier(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('suppliers').delete().eq('id', id)
  if (error) throw error
  revalidatePath('/suppliers')
}
