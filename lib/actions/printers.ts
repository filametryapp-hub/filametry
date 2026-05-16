'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { TRIAL_PRINTER_LIMIT } from '@/lib/stripe/plans'

export type PrinterData = {
  name: string
  brand: string
  model: string
  watts: number
  build_volume_mm?: { x: number; y: number; z: number } | null
  is_default?: boolean
}

export async function getUserPrinters() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('user_printers')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) throw error
  return data
}

export async function getPrinterCount(): Promise<number> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('user_printers')
    .select('*', { count: 'exact', head: true })

  if (error) throw error
  return count ?? 0
}

export async function addPrinter(data: PrinterData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Get the user's printer limit from their profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('printer_limit')
    .eq('id', user.id)
    .single()

  const limit: number = profile?.printer_limit ?? TRIAL_PRINTER_LIMIT
  const current = await getPrinterCount()

  if (current >= limit) {
    throw new Error(
      `You have reached your plan limit of ${limit} printer${limit !== 1 ? 's' : ''}. Upgrade your plan to add more.`
    )
  }

  const { error } = await supabase
    .from('user_printers')
    .insert({ ...data, user_id: user.id })

  if (error) throw error
  revalidatePath('/printers')
}

export async function updatePrinter(id: string, data: Partial<PrinterData>) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('user_printers')
    .update(data)
    .eq('id', id)

  if (error) throw error
  revalidatePath('/printers')
}

export async function deletePrinter(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('user_printers')
    .delete()
    .eq('id', id)

  if (error) throw error
  revalidatePath('/printers')
}
