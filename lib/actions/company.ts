'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getCompany() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  if (!profile?.company_id) return null

  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', profile.company_id)
    .single()

  if (error) return null
  return data
}

export async function createCompany(data: {
  name: string
  owner_name: string
  document?: string
  phone?: string
  email?: string
  address?: string
  city?: string
  state?: string
  country?: string
  is_partnership?: boolean
}): Promise<{ error: string } | { id: string; [key: string]: unknown }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const { data: company, error: companyError } = await supabase
      .from('companies')
      .insert({ ...data, owner_id: user.id })
      .select()
      .single()

    if (companyError) return { error: `Company insert failed: ${companyError.message} [${companyError.code}]` }

    const { error: cuError } = await supabase
      .from('company_users')
      .insert({
        company_id: company.id,
        user_id: user.id,
        role: 'owner',
        name: data.owner_name,
        email: user.email ?? '',
        status: 'active',
      })

    if (cuError) return { error: `Company user failed: ${cuError.message} [${cuError.code}]` }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ company_id: company.id })
      .eq('id', user.id)

    if (profileError) return { error: `Profile update failed: ${profileError.message} [${profileError.code}]` }

    revalidatePath('/dashboard')
    return company
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

export async function updateCompany(data: {
  name?: string
  owner_name?: string
  document?: string
  phone?: string
  email?: string
  address?: string
  city?: string
  state?: string
  country?: string
  is_partnership?: boolean
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  if (!profile?.company_id) throw new Error('No company found')

  const { error } = await supabase
    .from('companies')
    .update(data)
    .eq('id', profile.company_id)

  if (error) throw error
  revalidatePath('/dashboard')
}

export async function addPartner(data: {
  name: string
  email?: string
  percentage: number
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  if (!profile?.company_id) throw new Error('No company found')

  const { error } = await supabase
    .from('partners')
    .insert({ ...data, company_id: profile.company_id })

  if (error) throw error
  revalidatePath('/dashboard')
}

export async function removePartner(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('partners').delete().eq('id', id)
  if (error) throw error
  revalidatePath('/dashboard')
}

export async function getPartners() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  if (!profile?.company_id) return []

  const { data, error } = await supabase
    .from('partners')
    .select('*')
    .eq('company_id', profile.company_id)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data
}

export async function addCompanyUser(data: {
  name: string
  email: string
  role: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  if (!profile?.company_id) throw new Error('No company found')

  const { error } = await supabase
    .from('company_users')
    .insert({
      ...data,
      company_id: profile.company_id,
      status: 'pending',
    })

  if (error) throw error
  revalidatePath('/dashboard')
}

export async function getCompanyUsers() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  if (!profile?.company_id) return []

  const { data, error } = await supabase
    .from('company_users')
    .select('*')
    .eq('company_id', profile.company_id)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data
}
