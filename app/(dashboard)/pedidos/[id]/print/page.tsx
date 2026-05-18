import { getOrderById } from '@/lib/actions/orders'
import { notFound } from 'next/navigation'
import { PrintQuote } from './print-quote'

interface Props {
  params: Promise<{ id: string }>
}

export default async function PrintPage({ params }: Props) {
  const { id } = await params

  let row: Record<string, unknown>
  try {
    row = await getOrderById(id) as Record<string, unknown>
  } catch {
    notFound()
  }

  // Parse quote tiers
  const quoteTiers = Array.isArray(row.quote_tiers)
    ? (row.quote_tiers as { qty: number; unit_price: number }[]).map(t => ({
        qty:       Number(t.qty),
        unitPrice: Number(t.unit_price),
      }))
    : null

  // Parse items
  const items = Array.isArray(row.order_items)
    ? (row.order_items as Record<string, unknown>[]).map(i => ({
        productName: String(i.product_name),
        quantity:    Number(i.quantity),
        unitPrice:   Number(i.unit_price),
      }))
    : []

  const order = {
    id:                  String(row.id),
    clientName:          String(row.client_name),
    clientEmail:         row.client_email ? String(row.client_email) : undefined,
    notes:               row.notes ? String(row.notes) : undefined,
    status:              String(row.status),
    createdAt:           String(row.created_at ?? '').slice(0, 10),
    showDiscountOnPrint: Boolean(row.show_discount_on_print ?? false),
    quoteTiers,
    items,
    productName:         items[0]?.productName ?? '',
  }

  return <PrintQuote order={order} />
}
