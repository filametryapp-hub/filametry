'use client'

import { X, ChevronRight, Trash2 } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import {
  type Order,
  type OrderStatus,
  STATUS_LABELS,
  STATUS_COLORS,
  orderTotal,
} from '@/lib/product-types'

interface Props {
  order: Order
  onStatusChange: (status: OrderStatus) => void
  onDelete: () => void
  onClose: () => void
}

const FLOW: OrderStatus[] = ['draft', 'sent', 'accepted', 'printing', 'done']

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}

export function OrderDetail({ order, onStatusChange, onDelete, onClose }: Props) {
  const total      = orderTotal(order)
  const currentIdx = FLOW.indexOf(order.status)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-background shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{order.clientName}</h2>
            {order.clientEmail && (
              <p className="text-sm text-muted-foreground">{order.clientEmail}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={order.status} />
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Progress stepper */}
        {order.status !== 'cancelled' && (
          <div className="flex items-center gap-1">
            {FLOW.map((s, i) => (
              <div key={s} className="flex items-center gap-1 flex-1 last:flex-none">
                <div className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i <= currentIdx ? 'bg-orange-500' : 'bg-muted'
                }`} />
                {i === FLOW.length - 1 && (
                  <div className={`size-2 rounded-full ${
                    order.status === 'done' ? 'bg-orange-500' : 'bg-muted'
                  }`} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Items */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Items</p>
          {order.items.map((item, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span>{item.quantity}× {item.productName}</span>
              <span className="font-mono">{fmt(item.quantity * item.unitPrice)}</span>
            </div>
          ))}
          <Separator />
          <div className="flex justify-between text-sm font-semibold">
            <span>Total</span>
            <span className="font-mono text-orange-500">{fmt(total)}</span>
          </div>
        </div>

        {/* Notes */}
        {order.notes && (
          <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
            {order.notes}
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Created {order.createdAt} · Updated {order.updatedAt}</p>
          <button
            onClick={onDelete}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-400 transition-colors"
          >
            <Trash2 className="size-3.5" /> Delete
          </button>
        </div>

        {/* Status actions */}
        {order.status !== 'done' && order.status !== 'cancelled' && (
          <div className="space-y-2 pt-1 border-t border-border">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Move to</p>
            <div className="flex flex-wrap gap-2">
              {FLOW.filter((_, i) => i > currentIdx).map(s => (
                <button
                  key={s}
                  onClick={() => onStatusChange(s)}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border border-border hover:border-orange-500/50 hover:text-orange-400 transition-colors"
                >
                  {STATUS_LABELS[s]} <ChevronRight className="size-3" />
                </button>
              ))}
              <button
                onClick={() => onStatusChange('cancelled')}
                className="text-xs px-3 py-1.5 rounded-full border border-border hover:border-red-500/50 hover:text-red-400 transition-colors"
              >
                Cancel order
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
