'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Printer, Trash2, FileText, X, ClipboardList, ArrowRight } from 'lucide-react'
import { getQuotes, upsertQuote, deleteQuote, convertQuoteToOrder } from '@/lib/actions/quotes'
import { PAYMENT_METHODS } from '@/lib/constants'
import { getProducts } from '@/lib/actions/products'
import { useT } from '@/lib/i18n'
import { useRouter } from 'next/navigation'
import type { Quote, QuoteItem, QuoteTier } from '@/lib/actions/quotes'
import { type VolumeTier, resolveUnitPrice } from '@/lib/product-types'

// ── Types ──────────────────────────────────────────────────────
const DEFAULT_QTYS = [10, 20, 50, 100, 200]

type ProductOption = { id: string; name: string; priceUSD: number; volumePrices?: VolumeTier[] }

// ── Quote Form ─────────────────────────────────────────────────
function QuoteForm({
  initial, products, onSave, onClose,
}: {
  initial: Quote | null
  products: ProductOption[]
  onSave: (q: Quote) => void
  onClose: () => void
}) {
  const { t, fmtCurrency, currencySymbol } = useT()
  const qt = t.quotes

  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    company_name:  initial?.company_name  ?? '',
    company_email: initial?.company_email ?? '',
    company_phone: initial?.company_phone ?? '',
    client_name:   initial?.client_name   ?? '',
    client_address: initial?.client_address ?? '',
    discount_pct:    initial?.discount_pct    ?? 0,
    shipping:        initial?.shipping        ?? 0,
    packaging:       initial?.packaging       ?? 0,
    delivery_days:   initial?.delivery_days   ?? 7,
    valid_days:      initial?.valid_days      ?? 30,
    notes:           initial?.notes           ?? '',
    status:          initial?.status          ?? 'draft' as const,
    payment_method:  initial?.payment_method  ?? '',
  })
  const [items, setItems] = useState<QuoteItem[]>(
    initial?.items?.length ? initial.items : [{ product_name: '', qty: 1, unit_price: 0 }]
  )

  // ── Volume tiers ───────────────────────────────────────────
  const [tierProduct, setTierProduct] = useState<ProductOption | null>(null)
  const [tiers, setTiers] = useState<QuoteTier[]>(initial?.volume_tiers ?? [])
  const [newQty, setNewQty] = useState('')
  const [showDiscountOnPrint, setShowDiscountOnPrint] = useState(initial?.show_discount_on_print ?? false)

  function selectTierProduct(productId: string) {
    const prod = products.find(p => p.id === productId) ?? null
    setTierProduct(prod)
    if (prod) {
      setTiers(DEFAULT_QTYS.map(qty => ({
        qty,
        unitPrice: resolveUnitPrice(prod.priceUSD, prod.volumePrices, qty),
      })))
    } else {
      setTiers([])
    }
  }

  function addTier() {
    const qty = parseInt(newQty, 10)
    if (!qty || qty < 1 || tiers.some(t => t.qty === qty)) return
    const unitPrice = tierProduct
      ? resolveUnitPrice(tierProduct.priceUSD, tierProduct.volumePrices, qty)
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
    if (!tierProduct) return
    const newPrice = tierProduct.priceUSD * (1 - discountPct / 100)
    setTiers(prev => prev.map(t => t.qty === qty ? { ...t, unitPrice: Math.max(0, newPrice) } : t))
  }

  const subtotal  = items.reduce((s, i) => s + i.qty * i.unit_price, 0)
  const discount  = subtotal * (form.discount_pct / 100)
  const total     = subtotal - discount + form.shipping + form.packaging

  function addItem() {
    setItems(prev => [...prev, { product_name: '', qty: 1, unit_price: 0 }])
  }
  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }
  function updateItem(idx: number, patch: Partial<QuoteItem>) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it))
  }
  function pickProduct(idx: number, productId: string) {
    const p = products.find(p => p.id === productId)
    if (p) updateItem(idx, { product_name: p.name, unit_price: p.priceUSD })
  }

  async function handleSave() {
    if (!form.client_name.trim()) return
    setSaving(true)
    try {
      const payload = {
        ...form,
        items,
        volume_tiers: tiers.length > 0 ? tiers : undefined,
        show_discount_on_print: showDiscountOnPrint,
      }
      const id = await upsertQuote(initial?.id ?? null, payload)
      onSave({ ...payload, id, user_id: '', total, created_at: initial?.created_at ?? new Date().toISOString() })
    } finally {
      setSaving(false)
    }
  }

  const INPUT = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600/30 transition-colors placeholder:text-muted-foreground'
  const NUM   = 'w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600/30 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-border bg-background shadow-2xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="font-semibold text-base">{initial ? qt.saveQuote : qt.newQuote}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-5" /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Company */}
          <section className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{qt.companyInfo}</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-3">
                <label className="text-xs text-muted-foreground">{qt.companyName}</label>
                <input className={INPUT + ' mt-1'} value={form.company_name}
                  onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{qt.companyEmail}</label>
                <input className={INPUT + ' mt-1'} type="email" value={form.company_email}
                  onChange={e => setForm(f => ({ ...f, company_email: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">{qt.companyPhone}</label>
                <input className={INPUT + ' mt-1'} value={form.company_phone}
                  onChange={e => setForm(f => ({ ...f, company_phone: e.target.value }))} />
              </div>
            </div>
          </section>

          {/* Client */}
          <section className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{qt.clientInfo}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">{qt.clientName} *</label>
                <input className={INPUT + ' mt-1'} required value={form.client_name}
                  onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{qt.clientAddress}</label>
                <input className={INPUT + ' mt-1'} value={form.client_address}
                  onChange={e => setForm(f => ({ ...f, client_address: e.target.value }))} />
              </div>
            </div>
          </section>

          {/* Products */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{qt.products}</p>
              <button onClick={addItem}
                className="text-xs text-blue-600 hover:text-blue-500 flex items-center gap-1">
                <Plus className="size-3" /> {qt.addProduct}
              </button>
            </div>

            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left px-3 py-2 text-muted-foreground font-medium">{qt.product}</th>
                    <th className="text-right px-3 py-2 text-muted-foreground font-medium w-16">{qt.qty}</th>
                    <th className="text-right px-3 py-2 text-muted-foreground font-medium w-28">{qt.unitPrice}</th>
                    <th className="text-right px-3 py-2 text-muted-foreground font-medium w-24">{qt.subtotal}</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-2 py-1.5">
                        <div className="flex gap-1.5">
                          {products.length > 0 && (
                            <select
                              onChange={e => pickProduct(idx, e.target.value)}
                              className="h-8 rounded border border-input bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-600 shrink-0"
                              defaultValue="">
                              <option value="">↓</option>
                              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                          )}
                          <input
                            className="h-8 flex-1 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-600"
                            placeholder="Product name"
                            value={item.product_name}
                            onChange={e => updateItem(idx, { product_name: e.target.value })} />
                        </div>
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" min={1} step={1}
                          className={NUM + ' h-8 text-center w-16'}
                          value={item.qty}
                          onChange={e => updateItem(idx, { qty: Math.max(1, +e.target.value) })} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" min={0} step="any"
                          className={NUM + ' h-8 text-right w-28'}
                          value={item.unit_price || ''}
                          onChange={e => updateItem(idx, { unit_price: parseFloat(e.target.value) || 0 })} />
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                        {fmtCurrency(item.qty * item.unit_price)}
                      </td>
                      <td className="px-1 py-1.5 text-center">
                        {items.length > 1 && (
                          <button onClick={() => removeItem(idx)} className="text-muted-foreground hover:text-red-400">
                            <X className="size-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>{qt.subtotalProducts}</span>
                <span className="font-mono">{fmtCurrency(subtotal)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground">{qt.discount}</label>
                  <input type="number" min={0} max={100} step={0.5}
                    className={NUM + ' h-8 text-center mt-0.5'}
                    value={form.discount_pct || ''}
                    onChange={e => setForm(f => ({ ...f, discount_pct: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">{qt.packaging} ({currencySymbol})</label>
                  <input type="number" min={0} step="any"
                    className={NUM + ' h-8 text-right mt-0.5'}
                    value={form.packaging || ''}
                    onChange={e => setForm(f => ({ ...f, packaging: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">{qt.shipping} ({currencySymbol})</label>
                  <input type="number" min={0} step="any"
                    className={NUM + ' h-8 text-right mt-0.5'}
                    value={form.shipping || ''}
                    onChange={e => setForm(f => ({ ...f, shipping: parseFloat(e.target.value) || 0 }))} />
                </div>
              </div>

              {/* Payment method */}
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Payment method</label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {PAYMENT_METHODS.map(pm => (
                    <button
                      key={pm.value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, payment_method: f.payment_method === pm.value ? '' : pm.value }))}
                      className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors font-medium ${
                        form.payment_method === pm.value
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-border text-muted-foreground hover:border-blue-500/50 hover:text-blue-500'
                      }`}
                    >
                      {pm.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-between font-semibold text-base pt-1 border-t border-border">
                <span>{qt.totalQuote}</span>
                <span className="font-mono text-blue-600">{fmtCurrency(total)}</span>
              </div>
            </div>
          </section>

          {/* Volume Pricing Table */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{qt.volumeTable}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{qt.volumeTableDesc}</p>
              </div>
            </div>

            {/* Product selector for tiers */}
            <div className="flex items-center gap-2">
              <select
                value={tierProduct?.id ?? ''}
                onChange={e => selectTierProduct(e.target.value)}
                className="flex-1 h-8 rounded-lg border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-600">
                <option value="">{qt.selectForTable}</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.volumePrices?.length ? ` · ${p.volumePrices.length} ${qt.volumeTiers}` : ''}
                  </option>
                ))}
              </select>
              {tierProduct && (
                <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                  {qt.basePrice}: <span className="font-mono text-foreground">{fmtCurrency(tierProduct.priceUSD)}</span>
                </span>
              )}
            </div>

            {/* Tiers table */}
            {tiers.length > 0 && (
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="grid grid-cols-[52px_1fr_80px_80px_28px] gap-2 px-3 py-1.5 bg-muted/40 border-b border-border">
                  <span className="text-[10px] text-muted-foreground font-medium">{qt.tierQty}</span>
                  <span className="text-[10px] text-muted-foreground font-medium">{qt.tierUnitPrice}</span>
                  <span className="text-[10px] text-muted-foreground font-medium text-right">{qt.tierTotal}</span>
                  <span className="text-[10px] text-muted-foreground font-medium text-center">{qt.tierDiscount}</span>
                  <span />
                </div>
                {tiers.map((tier, idx) => {
                  const baseP = tierProduct?.priceUSD ?? 0
                  const discountPct = baseP > 0
                    ? Math.max(0, (baseP - tier.unitPrice) / baseP * 100)
                    : 0
                  const total = tier.qty * tier.unitPrice
                  return (
                    <div key={tier.qty}
                      className={`grid grid-cols-[52px_1fr_80px_80px_28px] gap-2 px-3 py-2 items-center ${idx !== 0 ? 'border-t border-border/60' : ''}`}>
                      <span className="text-sm font-semibold tabular-nums">{tier.qty}</span>
                      <input
                        type="number" min={0} step="any"
                        value={tier.unitPrice || ''}
                        onChange={e => updateTierPrice(tier.qty, parseFloat(e.target.value) || 0)}
                        className="h-7 w-full rounded border border-input bg-background px-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                      <span className="text-xs font-mono text-right text-blue-600 font-medium">{fmtCurrency(total)}</span>
                      <div className="relative flex items-center">
                        <input
                          type="number" min={0} max={100} step="0.1"
                          value={discountPct > 0 ? parseFloat(discountPct.toFixed(1)) : 0}
                          onChange={e => updateTierDiscount(tier.qty, parseFloat(e.target.value) || 0)}
                          className={`h-7 w-full rounded border bg-background pl-2 pr-5 text-xs font-medium text-center focus:outline-none focus:ring-1 focus:ring-blue-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${discountPct > 0 ? 'border-green-500/40 text-green-400' : 'border-input text-muted-foreground'}`} />
                        <span className="absolute right-1.5 text-[10px] text-muted-foreground pointer-events-none">%</span>
                      </div>
                      <button type="button" onClick={() => removeTier(tier.qty)}
                        className="text-muted-foreground hover:text-red-400 transition-colors flex justify-center">
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Add custom qty + presets */}
            {tierProduct && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={1} step={1}
                    value={newQty}
                    onChange={e => setNewQty(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTier() } }}
                    placeholder={qt.qtyPlaceholder}
                    className="h-8 w-32 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  <button type="button" onClick={addTier} disabled={!newQty}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-500 disabled:opacity-40 transition-colors">
                    <Plus className="size-3.5" /> {qt.addQty}
                  </button>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-muted-foreground">{qt.quickAdd}</span>
                  {DEFAULT_QTYS.map(qty => (
                    <button key={qty} type="button"
                      disabled={tiers.some(t => t.qty === qty)}
                      onClick={() => {
                        const unitPrice = resolveUnitPrice(tierProduct.priceUSD, tierProduct.volumePrices, qty)
                        setTiers(prev => [...prev, { qty, unitPrice }].sort((a, b) => a.qty - b.qty))
                      }}
                      className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground hover:border-blue-600/50 hover:text-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      {qty}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Print toggle */}
            {tiers.length > 0 && (
              <div className="rounded-lg border border-border bg-muted/20 px-3 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Printer className="size-3.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs font-medium">{qt.showDiscountOnPrint}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{qt.showDiscountDesc}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setShowDiscountOnPrint(v => !v)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${showDiscountOnPrint ? 'bg-blue-600' : 'bg-muted-foreground/30'}`}>
                  <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${showDiscountOnPrint ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
            )}
          </section>

          {/* Extra */}
          <section className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">{qt.deliveryDays}</label>
              <input type="number" min={1} className={NUM + ' mt-1'} value={form.delivery_days}
                onChange={e => setForm(f => ({ ...f, delivery_days: +e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{qt.validDays}</label>
              <input type="number" min={1} className={NUM + ' mt-1'} value={form.valid_days}
                onChange={e => setForm(f => ({ ...f, valid_days: +e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{qt.status}</label>
              <select value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as typeof form.status }))}
                className="mt-1 w-full h-9 rounded-lg border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600">
                {Object.entries(qt.statuses).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="col-span-3">
              <label className="text-xs text-muted-foreground">{t.common.notes}</label>
              <textarea rows={2} className={INPUT + ' mt-1 resize-none'} value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-border shrink-0">
          <button onClick={onClose}
            className="flex-1 rounded-md border border-border py-2 text-sm hover:bg-muted transition-colors">
            {t.common.cancel}
          </button>
          <button onClick={handleSave} disabled={saving || !form.client_name.trim()}
            className="flex-1 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 text-sm font-medium transition-colors">
            {saving ? t.common.saving : t.common.save}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Print Preview ──────────────────────────────────────────────
function PrintView({ quote, onClose }: { quote: Quote; onClose: () => void }) {
  const { fmtCurrency } = useT()
  const printRef = useRef<HTMLDivElement>(null)

  function handlePrint() {
    window.print()
  }

  const subtotal = quote.items.reduce((s, i) => s + i.qty * i.unit_price, 0)
  const discount = subtotal * ((quote.discount_pct ?? 0) / 100)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm print:hidden" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl flex flex-col max-h-[95vh]">

        {/* Toolbar — hidden on print */}
        <div className="flex items-center justify-between mb-3 print:hidden">
          <button onClick={onClose} className="text-white/70 hover:text-white flex items-center gap-1.5 text-sm">
            <X className="size-4" /> Close
          </button>
          <button onClick={handlePrint}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
            <Printer className="size-4" /> Print / Save PDF
          </button>
        </div>

        {/* Paper */}
        <div ref={printRef}
          className="filametry-print-paper bg-white text-gray-900 rounded-xl shadow-2xl overflow-y-auto flex-1 print:shadow-none print:rounded-none print:overflow-visible"
          style={{ fontFamily: 'system-ui, sans-serif' }}>
          <div className="p-10 space-y-8 print:p-8">

            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{quote.company_name || 'Quote'}</h1>
                {quote.company_email && <p className="text-sm text-gray-500">{quote.company_email}</p>}
                {quote.company_phone && <p className="text-sm text-gray-500">{quote.company_phone}</p>}
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-400">QUOTE</p>
                <p className="text-xs text-gray-400 mt-1">{new Date(quote.created_at).toLocaleDateString()}</p>
                {quote.valid_days && <p className="text-xs text-gray-400">Valid {quote.valid_days} days</p>}
              </div>
            </div>

            {/* Client */}
            <div className="border-t border-gray-100 pt-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">To</p>
              <p className="font-semibold text-gray-900">{quote.client_name}</p>
              {quote.client_address && <p className="text-sm text-gray-500">{quote.client_address}</p>}
            </div>

            {/* Items */}
            <div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-2 text-gray-500 font-semibold">Product / Service</th>
                    <th className="text-right py-2 text-gray-500 font-semibold w-16">Qty</th>
                    <th className="text-right py-2 text-gray-500 font-semibold w-28">Unit Price</th>
                    <th className="text-right py-2 text-gray-500 font-semibold w-28">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.items.map((item, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-3 text-gray-900">{item.product_name}</td>
                      <td className="py-3 text-right text-gray-700">{item.qty}</td>
                      <td className="py-3 text-right text-gray-700 font-mono">{fmtCurrency(item.unit_price)}</td>
                      <td className="py-3 text-right text-gray-900 font-mono font-medium">{fmtCurrency(item.qty * item.unit_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals block */}
              <div className="mt-4 flex justify-end">
                <div className="w-64 space-y-1.5 text-sm">
                  <div className="flex justify-between text-gray-500">
                    <span>Subtotal</span>
                    <span className="font-mono">{fmtCurrency(subtotal)}</span>
                  </div>
                  {(quote.discount_pct ?? 0) > 0 && (
                    <div className="flex justify-between text-gray-500">
                      <span>Discount ({quote.discount_pct}%)</span>
                      <span className="font-mono text-green-600">−{fmtCurrency(discount)}</span>
                    </div>
                  )}
                  {(quote.packaging ?? 0) > 0 && (
                    <div className="flex justify-between text-gray-500">
                      <span>Packaging</span>
                      <span className="font-mono">{fmtCurrency(quote.packaging ?? 0)}</span>
                    </div>
                  )}
                  {(quote.shipping ?? 0) > 0 && (
                    <div className="flex justify-between text-gray-500">
                      <span>Shipping</span>
                      <span className="font-mono">{fmtCurrency(quote.shipping ?? 0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base border-t border-gray-200 pt-2 text-gray-900">
                    <span>Total</span>
                    <span className="font-mono">{fmtCurrency(quote.total)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Volume Pricing Table (if present) */}
            {quote.volume_tiers && quote.volume_tiers.length > 0 && (() => {
              const tiers = quote.volume_tiers as QuoteTier[]
              // find base price from first item if possible
              const basePriceForDiscount = quote.items[0]?.unit_price ?? 0
              return (
                <div className="border-t border-gray-100 pt-6">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Volume Pricing</p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-gray-200">
                        <th className="text-left py-2 text-gray-500 font-semibold w-24">Qty</th>
                        <th className="text-right py-2 text-gray-500 font-semibold w-32">Unit Price</th>
                        <th className="text-right py-2 text-gray-500 font-semibold w-32">Total</th>
                        {quote.show_discount_on_print && (
                          <th className="text-right py-2 text-gray-500 font-semibold w-24">Discount</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {tiers.map((tier, i) => {
                        const total = tier.qty * tier.unitPrice
                        const discountPct = basePriceForDiscount > 0
                          ? Math.max(0, (basePriceForDiscount - tier.unitPrice) / basePriceForDiscount * 100)
                          : 0
                        return (
                          <tr key={i} className="border-b border-gray-100">
                            <td className="py-2.5 font-semibold text-gray-900">{tier.qty} units</td>
                            <td className="py-2.5 text-right text-gray-700 font-mono">{fmtCurrency(tier.unitPrice)}</td>
                            <td className="py-2.5 text-right text-gray-900 font-mono font-medium">{fmtCurrency(total)}</td>
                            {quote.show_discount_on_print && (
                              <td className={`py-2.5 text-right font-mono text-sm ${discountPct > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                {discountPct > 0 ? `−${discountPct.toFixed(1)}%` : '—'}
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            })()}

            {/* Footer info */}
            <div className="border-t border-gray-100 pt-6 grid grid-cols-2 gap-4 text-xs text-gray-500">
              {quote.delivery_days && (
                <p>Estimated delivery: <span className="font-medium text-gray-700">{quote.delivery_days} business days after approval</span></p>
              )}
              {quote.valid_days && (
                <p>Quote valid for: <span className="font-medium text-gray-700">{quote.valid_days} days</span></p>
              )}
              {quote.payment_method && (
                <p>Payment: <span className="font-medium text-gray-700">
                  {PAYMENT_METHODS.find(p => p.value === quote.payment_method)?.label ?? quote.payment_method}
                </span></p>
              )}
              {quote.notes && (
                <p className="col-span-2">Notes: <span className="text-gray-700">{quote.notes}</span></p>
              )}
            </div>

            <p className="text-center text-xs text-gray-300 pt-4">Generated with Filametry · filametry.com</p>
          </div>
        </div>
      </div>

      {/* Print-only full-page styles */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .filametry-print-paper,
          .filametry-print-paper * { visibility: visible !important; }
          .filametry-print-paper {
            position: fixed !important;
            inset: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  )
}

// ── Status badge ───────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  draft:    'bg-muted text-muted-foreground',
  sent:     'bg-blue-500/10 text-blue-400',
  accepted: 'bg-green-500/10 text-green-400',
  rejected: 'bg-red-500/10 text-red-400',
}

// ── Main page ──────────────────────────────────────────────────
export function QuotesPage() {
  const { t, fmtCurrency } = useT()
  const qt = t.quotes
  const router = useRouter()

  const [quotes, setQuotes]         = useState<Quote[]>([])
  const [products, setProducts]     = useState<ProductOption[]>([])
  const [loading, setLoading]       = useState(true)
  const [formQuote, setFormQuote]   = useState<Quote | null | 'new'>()
  const [printQuote, setPrintQuote] = useState<Quote | null>(null)
  const [deleting, setDeleting]     = useState<string | null>(null)
  const [converting, setConverting] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const qs = await getQuotes().catch(() => [] as Awaited<ReturnType<typeof getQuotes>>)
        setQuotes(qs)
      } catch { /* ignore */ }

      try {
        const prods = await getProducts().catch(() => [])
        setProducts((prods ?? []).map((p: Record<string, unknown>) => ({
          id: String(p.id),
          name: String(p.name ?? ''),
          priceUSD: Number(p.price_usd ?? p.priceUSD ?? 0),
          volumePrices: Array.isArray(p.volume_prices)
            ? (p.volume_prices as { min_qty: number; price_usd: number }[]).map(t => ({
                minQty: t.min_qty, priceUSD: t.price_usd,
              }))
            : undefined,
        })))
      } catch { /* ignore */ }

      setLoading(false)
    }
    load()
  }, [])

  function handleSaved(q: Quote) {
    setQuotes(prev => {
      const exists = prev.find(x => x.id === q.id)
      return exists ? prev.map(x => x.id === q.id ? q : x) : [q, ...prev]
    })
    setFormQuote(undefined)
  }

  async function handleDelete(id: string) {
    if (!confirm(qt.deleteConfirm)) return
    setDeleting(id)
    await deleteQuote(id)
    setQuotes(prev => prev.filter(q => q.id !== id))
    setDeleting(null)
  }

  async function handleConvert(quoteId: string) {
    setConverting(quoteId)
    try {
      await convertQuoteToOrder(quoteId)
      router.push('/pedidos')
    } catch (e) {
      console.error(e)
      setConverting(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{qt.title}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{qt.subtitle}</p>
        </div>
        <button
          onClick={() => setFormQuote('new')}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="size-4" /> {qt.newQuote}
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="size-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : quotes.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
          <ClipboardList className="size-10 opacity-20" />
          <p className="text-sm">{qt.noQuotes}</p>
          <button onClick={() => setFormQuote('new')}
            className="text-sm text-blue-600 hover:text-blue-500">{qt.newQuote}</button>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">{qt.client}</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">{qt.status}</th>
                <th className="text-right px-5 py-3 font-medium text-muted-foreground">{qt.total}</th>
                <th className="text-right px-5 py-3 font-medium text-muted-foreground">{qt.createdAt}</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {quotes.map(q => (
                <tr key={q.id} className="hover:bg-muted/20 transition-colors group">
                  <td className="px-5 py-3">
                    <p className="font-medium">{q.client_name}</p>
                    <p className="text-xs text-muted-foreground">{q.items.length} item{q.items.length !== 1 ? 's' : ''}</p>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[q.status ?? 'draft']}`}>
                        {qt.statuses[q.status as keyof typeof qt.statuses] ?? q.status}
                      </span>
                      {q.status === 'accepted' && (
                        <button
                          onClick={() => handleConvert(q.id)}
                          disabled={converting === q.id}
                          className="flex items-center gap-1 text-xs font-medium text-green-400 hover:text-green-300 border border-green-500/30 bg-green-500/10 rounded-full px-2 py-0.5 transition-colors disabled:opacity-50"
                          title="Send to Orders pipeline">
                          {converting === q.id
                            ? <span className="size-3 border border-green-400 border-t-transparent rounded-full animate-spin" />
                            : <ArrowRight className="size-3" />}
                          {converting === q.id ? 'Sending…' : 'Send to Orders'}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right font-mono font-semibold">{fmtCurrency(q.total)}</td>
                  <td className="px-5 py-3 text-right text-muted-foreground text-xs">
                    {new Date(q.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setPrintQuote(q)}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                        title="Print / PDF">
                        <Printer className="size-3.5" />
                      </button>
                      <button onClick={() => setFormQuote(q)}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                        <FileText className="size-3.5" />
                      </button>
                      <button onClick={() => handleDelete(q.id)}
                        disabled={deleting === q.id}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-red-400">
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Form modal */}
      {formQuote !== undefined && (
        <QuoteForm
          initial={formQuote === 'new' ? null : formQuote as Quote}
          products={products}
          onSave={handleSaved}
          onClose={() => setFormQuote(undefined)}
        />
      )}

      {/* Print modal */}
      {printQuote && (
        <PrintView quote={printQuote} onClose={() => setPrintQuote(null)} />
      )}
    </div>
  )
}
