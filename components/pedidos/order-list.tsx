'use client'

import { useState } from 'react'
import { Plus, ClipboardList, ChevronRight } from 'lucide-react'
import { OrderForm } from './order-form'
import { OrderDetail } from './order-detail'
import {
  type Order,
  STATUS_LABELS,
  STATUS_COLORS,
  orderTotal,
} from '@/lib/product-types'

const DEMO: Order[] = [
  {
    id: '1',
    clientName: 'John Smith',
    clientEmail: 'john@example.com',
    status: 'printing',
    notes: 'Needs to be done by Friday.',
    createdAt: '2025-05-10',
    updatedAt: '2025-05-12',
    items: [
      { productId: '1', productName: 'Rolling Egg Box', quantity: 2, unitPrice: 18 },
      { productId: '3', productName: 'Phone Stand', quantity: 1, unitPrice: 12 },
    ],
  },
  {
    id: '2',
    clientName: 'Maria Garcia',
    clientEmail: 'maria@example.com',
    status: 'sent',
    createdAt: '2025-05-13',
    updatedAt: '2025-05-13',
    items: [
      { productId: '2', productName: 'Cable Clip Set (×10)', quantity: 3, unitPrice: 6 },
    ],
  },
  {
    id: '3',
    clientName: 'Alex Chen',
    status: 'done',
    createdAt: '2025-05-01',
    updatedAt: '2025-05-08',
    items: [
      { productId: '1', productName: 'Rolling Egg Box', quantity: 1, unitPrice: 18 },
    ],
  },
]

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function StatusBadge({ status }: { status: Order['status'] }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}

export function OrderList() {
  const [orders, setOrders] = useState<Order[]>(DEMO)
  const [showForm, setShowForm] = useState(false)
  const [viewing, setViewing] = useState<Order | null>(null)
  const [filterStatus, setFilterStatus] = useState<Order['status'] | 'all'>('all')

  const filtered = filterStatus === 'all'
    ? orders
    : orders.filter(o => o.status === filterStatus)

  const totalRevenue = orders
    .filter(o => o.status === 'done')
    .reduce((s, o) => s + orderTotal(o), 0)

  const pending = orders.filter(o =>
    ['sent', 'accepted', 'printing'].includes(o.status)
  ).length

  function save(order: Order) {
    const isNew = !orders.find(o => o.id === order.id)
    setOrders(prev =>
      isNew
        ? [{ ...order, id: crypto.randomUUID() }, ...prev]
        : prev.map(o => o.id === order.id ? order : o)
    )
    setShowForm(false)
    setViewing(null)
  }

  const STATUSES: Array<Order['status'] | 'all'> = ['all', 'draft', 'sent', 'accepted', 'printing', 'done', 'cancelled']

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total orders',    value: orders.length.toString() },
          { label: 'Revenue (done)',  value: fmt(totalRevenue) },
          { label: 'In progress',     value: pending.toString() },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-border bg-card px-5 py-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Status filter pills */}
        <div className="flex gap-1.5 flex-wrap flex-1">
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors capitalize ${
                filterStatus === s
                  ? 'bg-orange-500 border-orange-500 text-white'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground'
              }`}
            >
              {s === 'all' ? 'All' : STATUS_LABELS[s as Order['status']]}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors whitespace-nowrap"
        >
          <Plus className="size-4" /> New order
        </button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <ClipboardList className="size-8 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-sm text-muted-foreground">No orders here yet.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          {filtered.map((order, i) => {
            const total = orderTotal(order)
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
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {itemCount} item{itemCount !== 1 ? 's' : ''} · {order.createdAt}
                    {order.clientEmail && ` · ${order.clientEmail}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono font-semibold text-sm">{fmt(total)}</p>
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

      {viewing && (
        <OrderDetail
          order={viewing}
          onStatusChange={(status) => {
            const updated = { ...viewing, status, updatedAt: new Date().toISOString().slice(0, 10) }
            save(updated)
            setViewing(updated)
          }}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  )
}
