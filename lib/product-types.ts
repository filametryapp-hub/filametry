export interface VolumeTier {
  minQty: number
  priceUSD: number
}

export interface Product {
  id: string
  name: string
  description: string
  material: string
  weightG: number
  printHours: number
  costUSD: number       // total production cost
  priceUSD: number      // sale price (1 unit, no volume)
  imageUrl?: string
  tags: string[]
  createdAt: string
  volumePrices?: VolumeTier[]
  status?: 'active' | 'failed' | 'test'  // 'failed' = tested/not approved, 'test' = prototype only
  productCode?: string            // e.g. '001'
  unitsPerRun?: number            // units per print plate
  batches?: number                // typical number of plates per run
}

export interface OrderItem {
  productId: string
  productName: string
  quantity: number
  unitPrice: number
}

export type OrderStatus = 'draft' | 'sent' | 'accepted' | 'printing' | 'done' | 'cancelled'

export interface QuoteTier {
  qty: number
  unitPrice: number
}

export interface Order {
  id: string
  clientName: string
  clientEmail?: string
  items: OrderItem[]
  status: OrderStatus
  notes?: string
  createdAt: string
  updatedAt: string
  quoteTiers?: QuoteTier[]         // multi-quantity proposal table
  showDiscountOnPrint?: boolean    // whether discount % column shows when printing
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  draft:     'Rascunho',
  sent:      'Enviado',
  accepted:  'Aceito',
  printing:  'Imprimindo',
  done:      'Concluído',
  cancelled: 'Cancelado',
}

export const STATUS_COLORS: Record<OrderStatus, string> = {
  draft:     'bg-zinc-500/10 text-zinc-400',
  sent:      'bg-blue-500/10 text-blue-400',
  accepted:  'bg-yellow-500/10 text-yellow-400',
  printing:  'bg-orange-500/10 text-orange-400',
  done:      'bg-green-500/10 text-green-400',
  cancelled: 'bg-red-500/10 text-red-400',
}

/** Given a product's volume tiers and a quantity, return the applicable unit price */
export function resolveUnitPrice(priceUSD: number, volumePrices: VolumeTier[] | undefined, qty: number): number {
  if (!volumePrices || volumePrices.length === 0) return priceUSD
  const sorted = [...volumePrices].sort((a, b) => b.minQty - a.minQty)
  const tier = sorted.find(t => qty >= t.minQty)
  return tier ? tier.priceUSD : priceUSD
}

export function orderTotal(order: Order): number {
  return order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
}
