'use client'

import { useState } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { type Order, type OrderItem, orderTotal } from '@/lib/product-types'

interface Props {
  onSave: (order: Order) => void
  onClose: () => void
}

const BLANK_ITEM: OrderItem = {
  productId: '',
  productName: '',
  quantity: 1,
  unitPrice: 0,
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export function OrderForm({ onSave, onClose }: Props) {
  const [clientName,  setClientName]  = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [notes,       setNotes]       = useState('')
  const [items,       setItems]       = useState<OrderItem[]>([{ ...BLANK_ITEM }])

  function addItem() {
    setItems(prev => [...prev, { ...BLANK_ITEM }])
  }

  function removeItem(i: number) {
    setItems(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateItem<K extends keyof OrderItem>(i: number, key: K, value: OrderItem[K]) {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [key]: value } : it))
  }

  const total = orderTotal({ items } as Order)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const now = new Date().toISOString().slice(0, 10)
    onSave({
      id: '',
      clientName,
      clientEmail: clientEmail || undefined,
      notes: notes || undefined,
      items,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <form
        onSubmit={submit}
        className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-background shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">New order</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>

        {/* Client */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Client name *</Label>
            <Input value={clientName} onChange={e => setClientName(e.target.value)}
              placeholder="John Smith" required />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Email (optional)</Label>
            <Input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)}
              placeholder="john@email.com" />
          </div>
        </div>

        {/* Items */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Items</Label>
            <button type="button" onClick={addItem}
              className="text-xs text-orange-500 hover:text-orange-400 flex items-center gap-1 transition-colors">
              <Plus className="size-3" /> Add item
            </button>
          </div>

          {items.map((item, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end">
              {/* Product name */}
              <div className="col-span-5 space-y-1">
                <Input
                  value={item.productName}
                  onChange={e => updateItem(i, 'productName', e.target.value)}
                  placeholder="Product name"
                  className="h-8 text-sm"
                  required
                />
              </div>
              {/* Qty */}
              <div className="col-span-2">
                <Input
                  type="number" min={1} step={1}
                  value={item.quantity}
                  onChange={e => updateItem(i, 'quantity', +e.target.value)}
                  className="h-8 text-sm text-center"
                />
              </div>
              {/* Unit price */}
              <div className="col-span-3">
                <Input
                  type="number" min={0} step={0.5}
                  value={item.unitPrice}
                  onChange={e => updateItem(i, 'unitPrice', +e.target.value)}
                  placeholder="$0.00"
                  className="h-8 text-sm"
                />
              </div>
              {/* Subtotal */}
              <div className="col-span-1 text-right">
                <span className="text-xs font-mono text-muted-foreground">
                  {fmt(item.quantity * item.unitPrice)}
                </span>
              </div>
              {/* Remove */}
              <div className="col-span-1 flex justify-end">
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(i)}
                    className="text-muted-foreground hover:text-red-400 transition-colors">
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Total */}
          <div className="flex justify-between items-center pt-2 border-t border-border">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="font-mono font-bold text-orange-500">{fmt(total)}</span>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Notes (optional)</Label>
          <Input value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Deadline, special instructions…" />
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 rounded-md border border-border py-2 text-sm hover:bg-muted transition-colors">
            Cancel
          </button>
          <button type="submit"
            className="flex-1 rounded-md bg-orange-500 hover:bg-orange-600 text-white py-2 text-sm font-medium transition-colors">
            Create order
          </button>
        </div>
      </form>
    </div>
  )
}
