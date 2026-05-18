'use client'

import { useState, useEffect } from 'react'
import { X, Plus, Trash2, ChevronDown, FileText, Printer } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { type Order, type VolumeTier, type QuoteTier, resolveUnitPrice } from '@/lib/product-types'
import { useT } from '@/lib/i18n'
import { getProducts } from '@/lib/actions/products'
import { getClients } from '@/lib/actions/clients'

interface CatalogProduct {
  id: string
  name: string
  priceUSD: number
  costUSD: number
  material: string
  volumePrices?: VolumeTier[]
}

interface CatalogClient {
  id: string
  name: string
  email?: string | null
}

interface Props {
  initial?: Order          // if provided → edit mode
  onSave: (order: Order) => void
  onClose: () => void
}

const INPUT_CLS =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-orange-500 placeholder:text-muted-foreground'

const DEFAULT_QTYS = [10, 20, 50, 100, 200]

export function OrderForm({ initial, onSave, onClose }: Props) {
  const { t, fmtCurrency } = useT()
  const isEditing = Boolean(initial)

  const [products,    setProducts]   = useState<CatalogProduct[]>([])
  const [clients,     setClients]    = useState<CatalogClient[]>([])
  const [loadingCat,  setLoadingCat] = useState(true)

  // Client — pre-fill from initial if editing
  const [clientName,  setClientName]  = useState(initial?.clientName ?? '')
  const [clientEmail, setClientEmail] = useState(initial?.clientEmail ?? '')
  const [notes,       setNotes]       = useState(initial?.notes ?? '')

  // Selected product — pre-fill from first item
  const [selectedProd, setSelectedProd] = useState<CatalogProduct | null>(null)

  // Quote tiers — pre-fill from initial
  const [tiers, setTiers] = useState<QuoteTier[]>(initial?.quoteTiers ?? [])
  const [newQty, setNewQty] = useState('')

  // Print option — pre-fill from initial
  const [showDiscountOnPrint, setShowDiscountOnPrint] = useState(initial?.showDiscountOnPrint ?? false)

  useEffect(() => {
    async function load() {
      try {
        const [prods, cls] = await Promise.all([getProducts(), getClients()])
        const mapped: CatalogProduct[] = (prods ?? []).map((p: Record<string, unknown>) => ({
          id:           String(p.id),
          name:         String(p.name),
          priceUSD:     Number(p.price_usd ?? 0),
          costUSD:      Number(p.cost_usd ?? 0),
          material:     String(p.material ?? ''),
          volumePrices: Array.isArray(p.volume_prices)
            ? (p.volume_prices as { min_qty: number; price_usd: number }[]).map(t => ({
                minQty: t.min_qty, priceUSD: t.price_usd,
              }))
            : undefined,
        }))
        setProducts(mapped)
        setClients(
          (cls ?? []).map((c: Record<string, unknown>) => ({
            id:    String(c.id),
            name:  String(c.name),
            email: c.email ? String(c.email) : null,
          }))
        )
        // In edit mode: find and pre-select the product from first item
        if (initial?.items[0]?.productId) {
          const found = mapped.find(p => p.id === initial.items[0].productId)
          if (found) setSelectedProd(found)
        }
      } catch { /* silent */ } finally {
        setLoadingCat(false)
      }
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function selectProduct(productId: string) {
    const prod = products.find(p => p.id === productId) ?? null
    setSelectedProd(prod)
    if (prod) {
      const initial = DEFAULT_QTYS.map(qty => ({
        qty,
        unitPrice: resolveUnitPrice(prod.priceUSD, prod.volumePrices, qty),
      }))
      setTiers(initial)
    } else {
      setTiers([])
    }
  }

  function addTier() {
    const qty = parseInt(newQty, 10)
    if (!qty || qty < 1 || tiers.some(t => t.qty === qty)) return
    const unitPrice = selectedProd
      ? resolveUnitPrice(selectedProd.priceUSD, selectedProd.volumePrices, qty)
      : 0
    setTiers(prev => [...prev, { qty, unitPrice }].sort((a, b) => a.qty - b.qty))
    setNewQty('')
  }

  function removeTier(qty: number) {
    setTiers(prev => prev.filter(t => t.qty !== qty))
  }

  function updateTierPrice(qty: number, price: number) {
    setTiers(prev => prev.map(t => t.qty === qty ? { ...t, unitPrice: price } : t))
  }

  function updateTierDiscount(qty: number, discountPct: number) {
    if (!selectedProd) return
    const newPrice = selectedProd.priceUSD * (1 - discountPct / 100)
    setTiers(prev => prev.map(t => t.qty === qty ? { ...t, unitPrice: Math.max(0, newPrice) } : t))
  }

  function selectClient(clientId: string) {
    const c = clients.find(cl => cl.id === clientId)
    if (!c) { setClientName(''); setClientEmail(''); return }
    setClientName(c.name)
    setClientEmail(c.email ?? '')
  }

  const basePrice = selectedProd?.priceUSD ?? 0

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedProd || tiers.length === 0) return
    const now = new Date().toISOString().slice(0, 10)
    const smallestTier = tiers[0]
    onSave({
      id:          initial?.id ?? '',
      clientName,
      clientEmail: clientEmail || undefined,
      notes:       notes || undefined,
      items: [{
        productId:   selectedProd.id,
        productName: selectedProd.name,
        quantity:    smallestTier.qty,
        unitPrice:   smallestTier.unitPrice,
      }],
      quoteTiers:         tiers,
      showDiscountOnPrint,
      status:    initial?.status ?? 'draft',
      createdAt: initial?.createdAt ?? now,
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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-orange-500" />
            <h2 className="text-lg font-semibold">{isEditing ? 'Editar Orçamento' : 'Novo Orçamento'}</h2>
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>

        {/* Client info */}
        <div className="space-y-3">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Cliente</Label>

          {clients.length > 0 && (
            <div className="relative">
              <select
                defaultValue=""
                onChange={e => selectClient(e.target.value)}
                className={INPUT_CLS + ' pr-8 appearance-none'}
              >
                <option value="">— selecionar cliente cadastrado —</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.email ? ` · ${c.email}` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            </div>
          )}

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

        {/* Product picker */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Produto</Label>

          {loadingCat ? (
            <div className="flex justify-center py-3">
              <div className="size-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="relative">
              <select
                value={selectedProd?.id ?? ''}
                onChange={e => selectProduct(e.target.value)}
                className={INPUT_CLS + ' pr-8 appearance-none'}
                required
              >
                <option value="">— selecionar produto —</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.material && !p.material.includes('[object') ? ` · ${p.material}` : ''}
                    {p.volumePrices?.length ? ' 🏷️' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            </div>
          )}

          {selectedProd && (
            <p className="text-[11px] text-muted-foreground">
              Preço base: <span className="font-mono text-foreground">{fmtCurrency(selectedProd.priceUSD)}</span>/un
              {selectedProd.volumePrices?.length
                ? <span className="ml-2 text-orange-500">· {selectedProd.volumePrices.length} faixas de volume</span>
                : null}
            </p>
          )}
        </div>

        {/* Quote tiers table */}
        {selectedProd && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                Tabela de Quantidades
              </Label>
            </div>

            {tiers.length === 0 && (
              <p className="text-[11px] text-muted-foreground/60 italic text-center py-2">
                Adicione quantidades para montar o orçamento
              </p>
            )}

            {tiers.length > 0 && (
              <div className="rounded-lg border border-border overflow-hidden">
                {/* Column headers */}
                <div className="grid grid-cols-[52px_1fr_80px_72px_28px] gap-2 px-3 py-1.5 bg-muted/40 border-b border-border">
                  <span className="text-[10px] text-muted-foreground font-medium">Qtd</span>
                  <span className="text-[10px] text-muted-foreground font-medium">Preço/un</span>
                  <span className="text-[10px] text-muted-foreground font-medium text-right">Total</span>
                  <span className="text-[10px] text-muted-foreground font-medium text-center">Desconto</span>
                  <span />
                </div>

                {tiers.map((tier, idx) => {
                  const discountPct = basePrice > 0
                    ? Math.max(0, (basePrice - tier.unitPrice) / basePrice * 100)
                    : 0
                  const total = tier.qty * tier.unitPrice

                  return (
                    <div
                      key={tier.qty}
                      className={`grid grid-cols-[52px_1fr_80px_72px_28px] gap-2 px-3 py-2 items-center ${
                        idx !== 0 ? 'border-t border-border/60' : ''
                      }`}
                    >
                      {/* Qty */}
                      <span className="text-sm font-semibold tabular-nums">{tier.qty}</span>

                      {/* Unit price (editable) */}
                      <input
                        type="number" min={0} step="any"
                        value={tier.unitPrice}
                        onChange={e => updateTierPrice(tier.qty, parseFloat(e.target.value) || 0)}
                        className="h-7 w-full rounded border border-input bg-background px-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-orange-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />

                      {/* Total */}
                      <span className="text-xs font-mono text-right text-orange-500 font-medium">
                        {fmtCurrency(total)}
                      </span>

                      {/* Discount % (editable, linked to price) */}
                      <div className="relative flex items-center">
                        <input
                          type="number" min={0} max={100} step="0.1"
                          value={discountPct > 0 ? parseFloat(discountPct.toFixed(1)) : 0}
                          onChange={e => updateTierDiscount(tier.qty, parseFloat(e.target.value) || 0)}
                          className={`h-7 w-full rounded border bg-background pl-2 pr-5 text-xs font-medium text-center focus:outline-none focus:ring-1 focus:ring-orange-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                            discountPct > 0
                              ? 'border-green-500/40 text-green-400'
                              : 'border-input text-muted-foreground'
                          }`}
                        />
                        <span className="absolute right-1.5 text-[10px] text-muted-foreground pointer-events-none">%</span>
                      </div>

                      {/* Remove */}
                      <button
                        type="button"
                        onClick={() => removeTier(tier.qty)}
                        className="text-muted-foreground hover:text-red-400 transition-colors flex justify-center"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Add custom qty */}
            <div className="flex items-center gap-2">
              <input
                type="number" min={1} step={1}
                value={newQty}
                onChange={e => setNewQty(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTier() } }}
                placeholder="Quantidade"
                className="h-8 w-32 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                type="button"
                onClick={addTier}
                disabled={!newQty}
                className="flex items-center gap-1 text-xs text-orange-500 hover:text-orange-400 disabled:opacity-40 transition-colors"
              >
                <Plus className="size-3.5" /> Adicionar quantidade
              </button>
            </div>

            {/* Quick-add preset buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-muted-foreground">Rápido:</span>
              {DEFAULT_QTYS.map(qty => (
                <button
                  key={qty}
                  type="button"
                  disabled={tiers.some(t => t.qty === qty)}
                  onClick={() => {
                    const unitPrice = resolveUnitPrice(selectedProd.priceUSD, selectedProd.volumePrices, qty)
                    setTiers(prev => [...prev, { qty, unitPrice }].sort((a, b) => a.qty - b.qty))
                  }}
                  className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground hover:border-orange-500/50 hover:text-orange-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  {qty}
                </button>
              ))}
            </div>

            {/* Print option */}
            <div className="rounded-lg border border-border bg-muted/20 px-3 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Printer className="size-3.5 text-muted-foreground" />
                <div>
                  <p className="text-xs font-medium">Mostrar desconto na impressão</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Por padrão a coluna de desconto não aparece no orçamento impresso
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDiscountOnPrint(v => !v)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                  showDiscountOnPrint ? 'bg-orange-500' : 'bg-muted-foreground/30'
                }`}
              >
                <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
                  showDiscountOnPrint ? 'translate-x-4' : 'translate-x-0'
                }`} />
              </button>
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t.orders.notes}</Label>
          <Input
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Prazo de entrega, instruções especiais…"
          />
        </div>

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-border py-2.5 text-sm hover:bg-muted transition-colors"
          >
            {t.common.cancel}
          </button>
          <button
            type="submit"
            disabled={!selectedProd || tiers.length === 0}
            className="flex-1 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white py-2.5 text-sm font-medium transition-colors"
          >
            {isEditing ? 'Salvar Alterações' : 'Salvar Orçamento'}
          </button>
        </div>
      </form>
    </div>
  )
}
