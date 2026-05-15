'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getFilaments() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('filaments')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function upsertFilament(filament: {
  id?: string
  brand: string
  material: string
  color: string
  color_hex: string
  weight_g: number
  remaining_g: number
  price_usd: number
  purchased_at?: string
  notes?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('filaments')
    .upsert({ ...filament, user_id: user.id }, { onConflict: 'id' })

  if (error) throw error
  revalidatePath('/filamentos')
}

export async function deleteFilament(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('filaments').delete().eq('id', id)
  if (error) throw error
  revalidatePath('/filamentos')
}
