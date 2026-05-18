'use client'

import { useState, useEffect } from 'react'
import { X, Plus, Trash2, Package, ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CurrencyInput } from '@/components/ui/currency-input'
import { type Order, type OrderItem, orderTotal } from '@/lib/product-types'
import { useT } from '@/lib/i18n'
import { getProducts } from '@/lib/actions/products'
import { getClients } from '@/lib/actions/clients'

interface CatalogProduct {
  id: string
  name: string
  priceUSD: number
  costUSD: number
  material: string
}

interface CatalogClient {
  id: string
  name: string
  email?: string | null
}

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

const INPUT_CLS = 'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-orange-500 placeholder:text-muted-foreground'

export function OrderForm({ onSave, onClose }: Props) {
  const { t, fmtCurrency } = useT()

  const [products,     setProducts]    = useState<CatalogProduct[]>([])
  const [clients,      setClients]     = useState<CatalogClient[]>([])
  const [clientName,   setClientName]  = useState('')
  const [clientEmail,  setClientEmail] = useState('')
  const [notes,        setNotes]       = useState('')
  const [items,        setItems]       = useState<OrderItem[]>([{ ...BLANK_ITEM }])
  const [loadingCat,   setLoadingCat]  = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [prods, cls] = await Promise.all([getProducts(), getClients()])
        setProducts(
          (prods ?? []).map((p: Record<string, unknown>) => ({
            id:       String(p.id),
            name:     String(p.name),
            priceUSD: Number(p.price_usd ?? 0),
            costUSD:  Number(p.cost_usd ?? 0),
            material: String(p.material ?? ''),
          }))
        )
        setClients(
          (cls ?? []).map((c: Record<string, unknown>) => ({
            id:    String(c.id),
            name:  String(c.name),
            email: c.email ? String(c.email) : null,
          }))
        )
      } catch { /* silent */ } finally {
        setLoadingCat(false)
      }
    }
    load()
  }, [])

  function addItem() {
    setItems(prev => [...prev, { ...BLANK_ITEM }])
  }

  function removeItem(i: number) {
    setItems(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateItem<K extends keyof OrderItem>(i: number, key: K, value: OrderItem[K]) {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [key]: value } : it))
  }

  function selectProduct(i: number, productId: string) {
    const prod = products.find(p => p.id === productId)
    if (!prod) {
      updateItem(i, 'productId',   '')
      updateItem(i, 'productName', '')
      updateItem(i, 'unitPrice',   0)
      return
    }
    setItems(prev => prev.map((it, idx) =>
      idx === i
        ? { ...it, productId: prod.id, productName: prod.name, unitPrice: prod.priceUSD }
        : it
    ))
  }

  function selectClient(clientId: string) {
    const c = clients.find(cl => cl.id === clientId)
    if (!c) { setClientName(''); setClientEmail(''); return }
    setClientName(c.name)
    setClientEmail(c.email ?? '')
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
          <h2 className="text-lg font-semibold">{t.orders.newOrder}</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>

        {/* Client */}
        <div className="space-y-3">
          {/* Client selector from catalog */}
          {clients.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Cliente do cadastro</Label>
              <div className="relative">
                <select
                  defaultValue=""
                  onChange={e => selectClient(e.target.value)}
                  className={INPUT_CLS + ' pr-8 appearance-none'}
                >
                  <option value="">— selecionar cliente —</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}{c.email ? ` · ${c.email}` : ''}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          )}

          {/* Manual client fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t.orders.clientName} *</Label>
              <Input value={clientName} onChange={e => setClientName(e.target.value)}
                placeholder="Nome completo" required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t.orders.clientEmail}</Label>
              <Input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)}
                placeholder="email@exemplo.com" />
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">{t.orders.items}</Label>
            <button type="button" onClick={addItem}
              className="text-xs text-orange-500 hover:text-orange-400 flex items-center gap-1 transition-colors">
              <Plus className="size-3" /> {t.orders.addItem}
            </button>
          </div>

          {loadingCat ? (
            <div className="flex justify-center py-4">
              <div className="size-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                  {/* Product picker */}
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Produto do catálogo</Label>
                    <div className="relative">
                      <select
                        value={item.productId}
                        onChange={e => selectProduct(i, e.target.value)}
                        className={INPUT_CLS + ' pr-8 appearance-none h-8 text-xs'}
                      >
                        <option value="">— selecionar produto —</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name}{p.material && typeof p.material === 'string' && !p.material.includes('[object') ? ` · ${p.material}` : ''} — {fmtCurrency(p.priceUSD)}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>

                  {/* Manual override + qty + price */}
                  <div className="grid grid-cols-12 gap-2 items-end">
                    {/* Product name (editable override) */}
                    <div className="col-span-5 space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Nome / descrição</Label>
                      <Input
                        value={item.productName}
                        onChange={e => updateItem(i, 'productName', e.target.value)}
                        placeholder="Nome do item"
                        className="h-8 text-xs"
                        required
                      />
                    </div>
                    {/* Qty */}
                    <div className="col-span-2 space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Qtd</Label>
                      <Input
                        type="number" min={1} step={1}
                        value={item.quantity}
                        onChange={e => updateItem(i, 'quantity', +e.target.value)}
                        className="h-8 text-xs text-center"
                      />
                    </div>
                    {/* Unit price */}
                    <div className="col-span-3 space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Preço unit.</Label>
                      <CurrencyInput
                        value={item.unitPrice}
                        onChange={v => updateItem(i, 'unitPrice', v)}
                        className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-orange-500"
                      />
                    </div>
                    {/* Subtotal + remove */}
                    <div className="col-span-2 flex items-center justify-between">
                      <span className="text-xs font-mono text-orange-500 font-medium">
                        {fmtCurrency(item.quantity * item.unitPrice)}
                      </span>
                      {items.length > 1 && (
                        <button type="button" onClick={() => removeItem(i)}
                          className="text-muted-foreground hover:text-red-400 transition-colors">
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Total */}
          <div className="flex justify-between items-center pt-2 border-t border-border">
            <span className="text-sm text-muted-foreground">{t.common.total}</span>
            <span className="font-mono font-bold text-orange-500 text-lg">{fmtCurrency(total)}</span>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t.orders.notes}</Label>
          <Input value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Prazo, instruções especiais…" />
        </div>

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 rounded-lg border border-border py-2.5 text-sm hover:bg-muted transition-colors">
            {t.common.cancel}
          </button>
          <button type="submit"
            className="flex-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-white py-2.5 text-sm font-medium transition-colors">
            {t.orders.createOrder}
          </button>
        </div>
      </form>
    </div>
  )
}
