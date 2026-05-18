'use client'

import { X, ChevronRight, Trash2, FileText, Printer, Pencil } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import {
  type Order,
  type OrderStatus,
  STATUS_COLORS,
  orderTotal,
} from '@/lib/product-types'
import { useT } from '@/lib/i18n'

interface Props {
  order: Order
  onStatusChange: (status: OrderStatus) => void
  onDelete: () => void
  onEdit: () => void
  onClose: () => void
}

const FLOW: OrderStatus[] = ['draft', 'sent', 'accepted', 'printing', 'done']

function StatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useT()
  const statusLabel = t.orders.status[status as keyof typeof t.orders.status] ?? status
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[status]}`}>
      {statusLabel}
    </span>
  )
}

export function OrderDetail({ order, onStatusChange, onDelete, onEdit, onClose }: Props) {
  const { t, fmtCurrency } = useT()
  const or = t.orders
  const total      = orderTotal(order)
  const currentIdx = FLOW.indexOf(order.status)

  const hasQuote = order.quoteTiers && order.quoteTiers.length > 0
  const showDiscount = order.showDiscountOnPrint ?? false
  // For discount calculation: max unitPrice among tiers = smallest qty = highest price (base)
  const maxTierPrice = hasQuote
    ? Math.max(...order.quoteTiers!.map(t => t.unitPrice))
    : (order.items[0]?.unitPrice ?? 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-background shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              {hasQuote && <FileText className="size-4 text-orange-500 shrink-0" />}
              <h2 className="text-lg font-semibold">{order.clientName}</h2>
            </div>
            {order.clientEmail && (
              <p className="text-sm text-muted-foreground">{order.clientEmail}</p>
            )}
            {hasQuote && order.items[0] && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Produto: <span className="text-foreground">{order.items[0].productName}</span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
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

        {/* Quote table (if this is a quote) */}
        {hasQuote ? (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Tabela de Orçamento</p>
            </div>

            <div className="rounded-lg border border-orange-500/20 overflow-hidden">
              {/* Column headers */}
              <div className={`grid gap-2 px-3 py-2 bg-orange-500/10 border-b border-orange-500/20 ${showDiscount ? 'grid-cols-[60px_1fr_80px_56px]' : 'grid-cols-[60px_1fr_80px]'}`}>
                <span className="text-[10px] font-semibold text-orange-500 uppercase">Qtd</span>
                <span className="text-[10px] font-semibold text-orange-500 uppercase">Preço/un</span>
                <span className="text-[10px] font-semibold text-orange-500 uppercase text-right">Total</span>
                {showDiscount && <span className="text-[10px] font-semibold text-orange-500 uppercase text-center">Desc.</span>}
              </div>

              {order.quoteTiers!.map((tier, idx) => {
                const discountPct = maxTierPrice > 0
                  ? ((maxTierPrice - tier.unitPrice) / maxTierPrice * 100)
                  : 0
                const rowTotal = tier.qty * tier.unitPrice

                return (
                  <div
                    key={tier.qty}
                    className={`grid gap-2 px-3 py-2.5 items-center ${showDiscount ? 'grid-cols-[60px_1fr_80px_56px]' : 'grid-cols-[60px_1fr_80px]'} ${
                      idx !== 0 ? 'border-t border-border/50' : ''
                    }`}
                  >
                    <span className="text-sm font-bold tabular-nums">{tier.qty}</span>
                    <span className="text-sm font-mono font-semibold text-foreground">
                      {fmtCurrency(tier.unitPrice)}
                    </span>
                    <span className="text-sm font-mono text-orange-500 font-semibold text-right">
                      {fmtCurrency(rowTotal)}
                    </span>
                    {showDiscount && (
                      <div className="flex justify-center">
                        {discountPct > 0 ? (
                          <span className="text-[11px] font-semibold text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded-full tabular-nums">
                            -{discountPct.toFixed(0)}%
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">base</span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Print hint */}
              <div className="px-3 py-2 border-t border-border/30 flex items-center gap-1.5">
                <Printer className="size-3 text-muted-foreground/50" />
                <span className="text-[10px] text-muted-foreground/60">
                  {showDiscount ? 'Desconto incluído na impressão' : 'Desconto oculto na impressão'}
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* Normal order items */
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{or.items}</p>
            {order.items.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span>{item.quantity}× {item.productName}</span>
                <span className="font-mono">{fmtCurrency(item.quantity * item.unitPrice)}</span>
              </div>
            ))}
            <Separator />
            <div className="flex justify-between text-sm font-semibold">
              <span>{t.common.total}</span>
              <span className="font-mono text-orange-500">{fmtCurrency(total)}</span>
            </div>
          </div>
        )}

        {/* Notes */}
        {order.notes && (
          <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
            {order.notes}
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Criado {order.createdAt} · Atualizado {order.updatedAt}</p>
          <div className="flex items-center gap-3">
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-orange-400 transition-colors"
            >
              <Pencil className="size-3.5" /> Alterar
            </button>
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-400 transition-colors"
            >
              <Trash2 className="size-3.5" /> {t.common.delete}
            </button>
          </div>
        </div>

        {/* Status actions */}
        {order.status !== 'done' && order.status !== 'cancelled' && (
          <div className="space-y-2 pt-1 border-t border-border">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{or.moveTo}</p>
            <div className="flex flex-wrap gap-2">
              {FLOW.filter((_, i) => i > currentIdx).map(s => (
                <button
                  key={s}
                  onClick={() => onStatusChange(s)}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border border-border hover:border-orange-500/50 hover:text-orange-400 transition-colors"
                >
                  {or.status[s as keyof typeof or.status]} <ChevronRight className="size-3" />
                </button>
              ))}
              <button
                onClick={() => onStatusChange('cancelled')}
                className="text-xs px-3 py-1.5 rounded-full border border-border hover:border-red-500/50 hover:text-red-400 transition-colors"
              >
                {or.cancelOrder}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
