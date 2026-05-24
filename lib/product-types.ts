export interface Consumable {
  id: string
  name: string
  unit: string          // ml, g, folha, un, etc.
  costPerUnit: number
  notes?: string
}

/** A consumable linked to a specific product with its quantity per unit */
export interface ProductConsumable {
  consumableId: string
  name: string          // denormalized for display
  unit: string
  costPerUnit: number
  quantityPerUnit: number
}

export function consumableCost(c: ProductConsumable): number {
  return c.quantityPerUnit * c.costPerUnit
}

export function totalConsumablesCost(items: ProductConsumable[]): number {
  return items.reduce((s, c) => s + consumableCost(c), 0)
}

export interface VolumeTier {
  minQty: number
  priceUSD: number
}

/** Long-print margin multiplier tier stored on the printer */
export interface LongPrintTier {
  minHours: number      // effective hours threshold (print_hours / printer_count)
  minMarginPct: number  // minimum margin % required
}

export const DEFAULT_LONG_PRINT_TIERS: LongPrintTier[] = [
  { minHours: 0, minMarginPct: 30 },
  { minHours: 4, minMarginPct: 45 },
  { minHours: 8, minMarginPct: 60 },
]

/** Returns the applicable long-print tier for a given number of effective hours */
export function resolveLongPrintTier(effectiveHours: number, tiers: LongPrintTier[]): LongPrintTier {
  const sorted = [...tiers].sort((a, b) => b.minHours - a.minHours)
  return sorted.find(t => effectiveHours >= t.minHours) ?? tiers[0]
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
  printerId?: string              // which printer runs this product
  printerCount?: number           // how many printers run in parallel (default 1)
  platesPerUnit?: boolean         // true = N chapas needed to make 1 unit (large multi-part prints)
  consumables?: ProductConsumable[] // post-processing materials (varnish, sandpaper, etc.)
  stockQty?: number               // units currently in finished-goods stock
  pricingSessionId?: string       // linked pricing_sessions row (set when saved from calculator)
  filamentColors?: FilamentColor[] // per-filament breakdown saved from pricing session
}

export interface FilamentColor {
  color: string      // hex e.g. "#FF6B35"
  type: string       // PLA / PETG / ABS …
  weightG: number    // grams used per unit
  spoolId?: string   // catalog spool ID if selected from stock
}

export interface OrderItem {
  productId: string
  productName: string
  quantity: number
  unitPrice: number
}

export type OrderStatus = 'draft' | 'sent' | 'accepted' | 'printing' | 'post' | 'done' | 'cancelled'

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
  tip?: number                     // extra amount received (tips, rounding, etc.)
  payment_method?: string          // pix, card, cash, etc.
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  draft:     'Rascunho',
  sent:      'Enviado',
  accepted:  'Aceito',
  printing:  'Imprimindo',
  post:      'Pós-processamento',
  done:      'Concluído',
  cancelled: 'Cancelado',
}

export const STATUS_COLORS: Record<OrderStatus, string> = {
  draft:     'bg-zinc-500/10 text-zinc-400',
  sent:      'bg-blue-500/10 text-blue-400',
  accepted:  'bg-yellow-500/10 text-yellow-400',
  printing:  'bg-blue-600/10 text-blue-500',
  post:      'bg-purple-500/10 text-purple-400',
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
