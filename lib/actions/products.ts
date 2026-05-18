'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getProducts() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function upsertProduct(product: {
  id?: string
  name: string
  description?: string
  material: string
  weight_g: number
  print_hours: number
  cost_usd: number
  price_usd: number
  image_url?: string
  tags: string[]
  volume_prices?: { min_qty: number; price_usd: number }[] | null
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('products')
    .upsert({ ...product, user_id: user.id }, { onConflict: 'id' })

  if (error) throw error
  revalidatePath('/produtos')
}

export async function deleteProduct(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) throw error
  revalidatePath('/produtos')
}
