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
  product_code?: string
  units_per_run?: number
  batches?: number | null
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Auto-generate code for new products
  let productCode = product.product_code
  if (!product.id && !productCode) {
    const { data: last } = await supabase
      .from('products')
      .select('product_code')
      .not('product_code', 'is', null)
      .order('product_code', { ascending: false })
      .limit(1)
      .single()
    const nextNum = last?.product_code ? parseInt(last.product_code, 10) + 1 : 1
    productCode = String(nextNum).padStart(3, '0')
  }

  const { error } = await supabase
    .from('products')
    .upsert({
      ...product,
      user_id: user.id,
      product_code: productCode,
    }, { onConflict: 'id' })

  if (error) throw error
  revalidatePath('/produtos')
}

export async function setProductStatus(id: string, status: 'active' | 'failed') {
  const supabase = await createClient()
  const { error } = await supabase.from('products').update({ status }).eq('id', id)
  if (error) throw error
  revalidatePath('/produtos')
}

export async function deleteProduct(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) throw error
  revalidatePath('/produtos')
}
