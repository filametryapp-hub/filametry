'use client'

import { useState, useEffect } from 'react'
import { getOrders, updateOrderStatus } from '@/lib/actions/orders'
import { useT } from '@/lib/i18n'
import { ClipboardList } from 'lucide-react'

type Order = {
  id: string
  client_name: string
  status: string
  notes?: string | null
  due_date?: string | null
  total_price?: number | null
  created_at: string
  order_items: { quantity: number; unit_price: number; product_name?: string | null }[]
}

type Column = {
  key: string
  label: string
  color: string
  border: string
  dot: string
}

function urgencyClass(dueDate?: string | null): string {
  if (!dueDate) return ''
  const days = Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86400000)
  if (days < 0) return 'border-l-4 border-red-500'
  if (days <= 2) return 'border-l-4 border-yellow-500'
  return 'border-l-4 border-green-500'
}

export function ProductionKanban() {
  const { t, fmtCurrency } = useT()
  const pr = t.production

  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [moving, setMoving] = useState<string | null>(null)

  const COLUMNS: Column[] = [
    { key: 'accepted', label: pr.queue,          color: 'bg-blue-500/5',   border: 'border-blue-500/30',   dot: 'bg-blue-400' },
    { key: 'printing', label: pr.printing,       color: 'bg-blue-600/5', border: 'border-blue-600/30', dot: 'bg-blue-500' },
    { key: 'post',     label: pr.postProcessing,  color: 'bg-purple-500/5', border: 'border-purple-500/30', dot: 'bg-purple-400' },
    { key: 'done',     label: pr.done,            color: 'bg-green-500/5',  border: 'border-green-500/30',  dot: 'bg-green-400' },
  ]

  const STATUS_FLOW: Record<string, string> = {
    accepted: 'printing',
    printing: 'post',
    post:     'done',
    done:     'done',
  }

  useEffect(() => {
    getOrders()
      .then(data => setOrders((data ?? []) as Order[]))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false))
  }, [])

  const productionOrders = orders.filter(o =>
    ['accepted', 'printing', 'post', 'done'].includes(o.status)
  )

  async function advance(orderId: string, currentStatus: string) {
    const next = STATUS_FLOW[currentStatus]
    if (!next || next === currentStatus) return
    setMoving(orderId)
    try {
      await updateOrderStatus(orderId, next)
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: next } : o))
    } catch (err) {
      console.error('Failed to advance order:', err)
    } finally {
      setMoving(null)
    }
  }

  function ordersFor(col: Column) {
    return productionOrders.filter(o => o.status === col.key)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{pr.title}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{pr.subtitle}</p>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-green-500" />{pr.onTime}</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-yellow-500" />{pr.attention}</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-red-500" />{pr.overdue}</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="size-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          {COLUMNS.map(col => {
            const colOrders = ordersFor(col)
            return (
              <div key={col.key} className={`rounded-xl border ${col.border} ${col.color} p-3 space-y-2 min-h-[400px]`}>
                {/* Column header */}
                <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                  <span className={`size-2 rounded-full ${col.dot}`} />
                  <span className="text-xs font-semibold text-foreground">{col.label}</span>
                  <span className="ml-auto text-[10px] bg-muted rounded-full px-1.5 py-0.5 tabular-nums">
                    {colOrders.length}
                  </span>
                </div>

                {/* Cards */}
                {colOrders.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground/50 text-center py-6 italic">{pr.noOrders}</p>
                ) : (
                  colOrders.map(order => {
                    const total = order.order_items.reduce((s, i) => s + i.quantity * i.unit_price, 0)
                    const isMoving = moving === order.id
                    return (
                      <div key={order.id}
                        className={`bg-background rounded-lg border border-border p-3 space-y-2 shadow-sm ${urgencyClass(order.due_date)}`}>
                        <div>
                          <p className="text-sm font-medium leading-tight">{order.client_name}</p>
                          {order.order_items.length > 0 && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {order.order_items.length} item{order.order_items.length !== 1 ? 's' : ''}
                              {order.order_items[0]?.product_name ? ` · ${order.order_items[0].product_name}${order.order_items.length > 1 ? '…' : ''}` : ''}
                            </p>
                          )}
                        </div>

                        {total > 0 && (
                          <p className="text-xs font-mono font-semibold text-blue-600">{fmtCurrency(total)}</p>
                        )}

                        {order.due_date && (
                          <p className="text-[10px] text-muted-foreground">
                            Due: {new Date(order.due_date).toLocaleDateString()}
                          </p>
                        )}

                        {order.notes && (
                          <p className="text-[10px] text-muted-foreground/60 truncate">{order.notes}</p>
                        )}

                        {col.key !== 'done' && (
                          <button
                            onClick={() => advance(order.id, col.key)}
                            disabled={isMoving}
                            className="w-full text-[11px] font-medium py-1 rounded-md border border-border hover:bg-muted disabled:opacity-50 transition-colors text-muted-foreground hover:text-foreground">
                            {isMoving ? '…' : `→ ${COLUMNS.find(c => c.key === STATUS_FLOW[col.key])?.label}`}
                          </button>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            )
          })}
        </div>
      )}

      {productionOrders.length === 0 && !loading && (
        <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
          <ClipboardList className="size-8 opacity-20" />
          <p className="text-sm">No orders in production yet. Accept an order to get started.</p>
        </div>
      )}
    </div>
  )
}
