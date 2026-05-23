'use client'

import { useState, useEffect } from 'react'
import { Plus, ClipboardList, ChevronRight, FileText } from 'lucide-react'
import { OrderForm } from './order-form'
import { OrderDetail } from './order-detail'
import { getOrders, createOrder, updateOrder, updateOrderStatus, deleteOrder } from '@/lib/actions/orders'
import {
  type Order,
  type OrderItem,
  type QuoteTier,
  STATUS_COLORS,
  orderTotal,
} from '@/lib/product-types'
import { useT } from '@/lib/i18n'

// Map DB row → Order
function fromRow(row: Record<string, unknown>): Order {
  const items = Array.isArray(row.order_items)
    ? (row.order_items as Record<string, unknown>[]).map(i => ({
        productId:   i.product_id ? String(i.product_id) : '',
        productName: String(i.product_name),
        quantity:    Number(i.quantity),
        unitPrice:   Number(i.unit_price),
      }) as OrderItem)
    : []

  const quoteTiers: QuoteTier[] | undefined = Array.isArray(row.quote_tiers)
    ? (row.quote_tiers as { qty: number; unit_price: number }[]).map(t => ({
        qty: Number(t.qty),
        unitPrice: Number(t.unit_price),
      }))
    : undefined

  return {
    id:                  String(row.id),
    clientName:          String(row.client_name),
    clientEmail:         row.client_email ? String(row.client_email) : undefined,
    status:              String(row.status) as Order['status'],
    notes:               row.notes ? String(row.notes) : undefined,
    items,
    quoteTiers,
    showDiscountOnPrint: Boolean(row.show_discount_on_print ?? false),
    createdAt:           String(row.created_at ?? '').slice(0, 10),
    updatedAt:           String(row.updated_at ?? row.created_at ?? '').slice(0, 10),
  }
}

function StatusBadge({ status }: { status: Order['status'] }) {
  const { t } = useT()
  const statusLabel = t.orders.status[status as keyof typeof t.orders.status] ?? status
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[status]}`}>
      {statusLabel}
    </span>
  )
}

export function OrderList() {
  const { t, fmtCurrency } = useT()
  const or = t.orders
  const [orders, setOrders]       = useState<Order[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [editing, setEditing]     = useState<Order | null>(null)
  const [viewing, setViewing]     = useState<Order | null>(null)
  const [filterStatus, setFilter] = useState<Order['status'] | 'all'>('all')

  async function load() {
    setLoading(true)
    try {
      const rows = await getOrders()
      setOrders((rows ?? []).map(r => fromRow(r as Record<string, unknown>)))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = filterStatus === 'all'
    ? orders
    : orders.filter(o => o.status === filterStatus)

  const totalRevenue = orders
    .filter(o => o.status === 'done')
    .reduce((s, o) => s + orderTotal(o), 0)

  const pending = orders.filter(o =>
    ['sent', 'accepted', 'printing'].includes(o.status)
  ).length

  function buildPayload(order: Order) {
    return {
      client_name:            order.clientName,
      client_email:           order.clientEmail,
      notes:                  order.notes,
      quote_tiers:            order.quoteTiers?.map(t => ({
        qty:        t.qty,
        unit_price: t.unitPrice,
      })) ?? null,
      show_discount_on_print: order.showDiscountOnPrint ?? false,
      items: order.items.map(i => ({
        product_id:   i.productId || undefined,
        product_name: i.productName,
        quantity:     i.quantity,
        unit_price:   i.unitPrice,
      })),
    }
  }

  async function save(order: Order) {
    if (order.id) {
      // Edit mode
      await updateOrder(order.id, buildPayload(order))
    } else {
      // Create mode
      await createOrder(buildPayload(order))
    }
    await load()
    setShowForm(false)
    setEditing(null)
    setViewing(null)
  }

  async function changeStatus(id: string, status: Order['status']) {
    await updateOrderStatus(id, status)
    await load()
  }

  async function remove(id: string) {
    await deleteOrder(id)
    setOrders(prev => prev.filter(o => o.id !== id))
    setViewing(null)
  }

  const STATUSES: Array<Order['status'] | 'all'> = ['all', 'draft', 'sent', 'accepted', 'printing', 'done', 'cancelled']

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="size-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: or.totalOrders,   value: orders.length.toString() },
          { label: or.revenueDone,   value: fmtCurrency(totalRevenue) },
          { label: or.inProgress,    value: pending.toString() },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-border bg-card px-5 py-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1.5 flex-wrap flex-1">
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors capitalize ${
                filterStatus === s
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground'
              }`}
            >
              {s === 'all' ? or.status.all : or.status[s as keyof typeof or.status]}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors whitespace-nowrap"
        >
          <Plus className="size-4" /> {or.newOrder}
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <ClipboardList className="size-8 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-sm text-muted-foreground">{or.noOrders}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          {filtered.map((order, i) => {
            const total     = orderTotal(order)
            const itemCount = order.items.reduce((s, it) => s + it.quantity, 0)
            return (
              <button
                key={order.id}
                onClick={() => setViewing(order)}
                className={`w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-muted/50 transition-colors ${
                  i !== 0 ? 'border-t border-border' : ''
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{order.clientName}</span>
                    <StatusBadge status={order.status} />
                    {order.quoteTiers && order.quoteTiers.length > 0 && (
                      <span className="flex items-center gap-0.5 text-[10px] text-blue-600 bg-blue-600/10 px-1.5 py-0.5 rounded-full">
                        <FileText className="size-2.5" /> orçamento
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {order.quoteTiers?.length
                      ? `${order.quoteTiers.length} faixas · ${order.createdAt}`
                      : `${itemCount} item${itemCount !== 1 ? 's' : ''} · ${order.createdAt}`}
                    {order.clientEmail && ` · ${order.clientEmail}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono font-semibold text-sm">{fmtCurrency(total)}</p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground shrink-0" />
              </button>
            )
          })}
        </div>
      )}

      {showForm && (
        <OrderForm
          onSave={save}
          onClose={() => setShowForm(false)}
        />
      )}

      {editing && (
        <OrderForm
          initial={editing}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}

      {viewing && !editing && (
        <OrderDetail
          order={viewing}
          onStatusChange={(status) => {
            changeStatus(viewing.id, status)
            setViewing(prev => prev ? { ...prev, status } : null)
          }}
          onDelete={() => remove(viewing.id)}
          onEdit={() => { setEditing(viewing); setViewing(null) }}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  )
}
