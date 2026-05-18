'use client'

import { useState } from 'react'
import { X, Plus, Trash2, ShoppingCart, Package } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CurrencyInput } from '@/components/ui/currency-input'
import { MATERIALS, type MaterialCategory, type MaterialUnit } from '@/lib/filament-types'
import { batchUpsertFilaments } from '@/lib/actions/filaments'
import { useT } from '@/lib/i18n'

// ── Common material type groups for quick selection ───────────
const MATERIAL_GROUPS = [
  { label: 'PLA',      items: ['PLA', 'PLA+', 'PLA Matte', 'PLA Silk', 'PLA-CF'] },
  { label: 'PETG',     items: ['PETG', 'PETG-CF'] },
  { label: 'ABS/ASA',  items: ['ABS', 'ASA'] },
  { label: 'Flexível', items: ['TPU', 'TPE'] },
  { label: 'Técnico',  items: ['PA (Nylon)', 'PA-CF', 'PA-GF', 'PC', 'PC-ABS'] },
  { label: 'Outros',   items: ['HIPS', 'PVA', 'Resin (Standard)', 'Resin (ABS-like)', 'Resin (Flexible)'] },
]

const CATEGORIES: MaterialCategory[] = ['Filament', 'Tool', 'Packaging', 'Accessory', 'Other']
const UNITS: MaterialUnit[] = ['g', 'kg', 'units', 'm', 'ml']

interface BatchItem {
  id: string
  color: string
  colorHex: string
  weightG: number
  priceUSD: number
  notes: string
}

function newItem(defaultWeight: number, defaultPrice: number): BatchItem {
  return {
    id: crypto.randomUUID(),
    color: '',
    colorHex: '#888888',
    weightG: defaultWeight,
    priceUSD: defaultPrice,
    notes: '',
  }
}

interface Props {
  onSaved: () => void
  onClose: () => void
}

const INPUT = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors placeholder:text-muted-foreground h-9'

export function BatchEntryModal({ onSaved, onClose }: Props) {
  const { t, fmtCurrency, currencySymbol } = useT()
  const m = t.materials

  // ── Shared fields ──────────────────────────────────────────
  const [category,     setCategory]    = useState<MaterialCategory>('Filament')
  const [material,     setMaterial]    = useState('PLA')
  const [brand,        setBrand]       = useState('')
  const [spoolWeightG, setSpoolWeightG] = useState(1000)
  const [unit,         setUnit]        = useState<MaterialUnit>('g')
  const [purchasedAt,  setPurchasedAt] = useState(new Date().toISOString().slice(0, 10))
  const [sharedPrice,  setSharedPrice] = useState(0)   // if > 0, pre-fills all items
  const [applyPriceAll, setApplyPriceAll] = useState(true)

  // ── Items list ─────────────────────────────────────────────
  const [items, setItems] = useState<BatchItem[]>([newItem(1000, 0)])

  // ── Submission ─────────────────────────────────────────────
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const isFilament = category === 'Filament'
  const totalCost  = items.reduce((s, i) => s + i.priceUSD, 0)

  function addItem() {
    setItems(prev => [...prev, newItem(spoolWeightG, applyPriceAll ? sharedPrice : 0)])
  }

  function removeItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  function updateItem<K extends keyof BatchItem>(id: string, key: K, value: BatchItem[K]) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [key]: value } : i))
  }

  function applySharedPrice(price: number) {
    setSharedPrice(price)
    if (applyPriceAll) {
      setItems(prev => prev.map(i => ({ ...i, priceUSD: price })))
    }
  }

  async function handleSave() {
    if (!brand.trim()) { setError('Marca é obrigatória.'); return }
    const invalid = items.findIndex(i => !i.color.trim())
    if (invalid >= 0) { setError(`Item ${invalid + 1}: nome/cor é obrigatório.`); return }

    setSaving(true)
    setError('')
    try {
      await batchUpsertFilaments(items.map(item => ({
        brand:        brand.trim(),
        material:     isFilament ? material : '',
        color:        item.color.trim(),
        color_hex:    item.colorHex,
        weight_g:     item.weightG,
        remaining_g:  item.weightG,
        price_usd:    item.priceUSD,
        purchased_at: purchasedAt,
        notes:        item.notes || undefined,
        category,
        unit,
      })))
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : t.common.error)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-border bg-background shadow-2xl flex flex-col max-h-[92vh]">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <ShoppingCart className="size-4 text-orange-500" />
            </div>
            <div>
              <h2 className="font-semibold">Entrada em Lote</h2>
              <p className="text-xs text-muted-foreground">Adicione vários itens de uma mesma compra</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="size-4" />
          </button>
        </div>

        {/* ── Body (scrollable) ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Category */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Categoria</Label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map(cat => (
                <button key={cat} type="button" onClick={() => setCategory(cat)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    category === cat
                      ? 'border-orange-500 bg-orange-500/10 text-orange-500'
                      : 'border-border text-muted-foreground hover:border-orange-500/40'
                  }`}>
                  {m.categories[cat]}
                </button>
              ))}
            </div>
          </div>

          {/* Material type — hero */}
          {isFilament && (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tipo de material</Label>
              <div className="space-y-2">
                {MATERIAL_GROUPS.map(group => (
                  <div key={group.label} className="flex flex-wrap gap-1.5 items-center">
                    <span className="text-[10px] text-muted-foreground/60 w-14 shrink-0">{group.label}</span>
                    {group.items.map(mat => (
                      <button key={mat} type="button" onClick={() => setMaterial(mat)}
                        className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                          material === mat
                            ? 'border-orange-500 bg-orange-500 text-white font-medium'
                            : 'border-border text-muted-foreground hover:border-orange-500/50'
                        }`}>
                        {mat}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Shared fields row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Marca *</Label>
              <input className={INPUT} placeholder="ex: Bambu Lab, eSUN, Creality"
                value={brand} onChange={e => setBrand(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Qtd por item ({unit})</Label>
              <input className={INPUT} type="number" min={1} step={isFilament ? 50 : 1}
                value={spoolWeightG}
                onChange={e => {
                  const v = +e.target.value
                  setSpoolWeightG(v)
                  setItems(prev => prev.map(i => ({ ...i, weightG: v })))
                }} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Unidade</Label>
              <select value={unit} onChange={e => setUnit(e.target.value as MaterialUnit)}
                className={INPUT}>
                {UNITS.map(u => <option key={u} value={u}>{m.units[u]}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Data da compra</Label>
              <input className={INPUT} type="date" value={purchasedAt}
                onChange={e => setPurchasedAt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Preço padrão ({currencySymbol})</Label>
              <CurrencyInput value={sharedPrice} onChange={applySharedPrice}
                className={INPUT} />
            </div>
            <div className="col-span-2 flex items-end pb-0.5">
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                <input type="checkbox" checked={applyPriceAll}
                  onChange={e => {
                    setApplyPriceAll(e.target.checked)
                    if (e.target.checked && sharedPrice > 0) {
                      setItems(prev => prev.map(i => ({ ...i, priceUSD: sharedPrice })))
                    }
                  }}
                  className="rounded border-border accent-orange-500" />
                Aplicar mesmo preço a todos
              </label>
            </div>
          </div>

          {/* ── Items ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Itens — {items.length} {items.length === 1 ? 'item' : 'itens'}
              </Label>
              <span className="text-xs text-muted-foreground">
                Total: <span className="font-semibold text-foreground">{fmtCurrency(totalCost)}</span>
              </span>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-[1fr_36px_120px_120px_32px] gap-2 px-1">
              <span className="text-[10px] text-muted-foreground">Cor / Nome</span>
              <span className="text-[10px] text-muted-foreground text-center">Cor</span>
              <span className="text-[10px] text-muted-foreground text-center">Qtd ({unit})</span>
              <span className="text-[10px] text-muted-foreground text-center">Preço ({currencySymbol})</span>
              <span />
            </div>

            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={item.id}
                  className="grid grid-cols-[1fr_36px_120px_120px_32px] gap-2 items-center rounded-lg border border-border bg-muted/20 px-3 py-2">

                  {/* Color name */}
                  <input
                    className="bg-transparent text-sm outline-none placeholder:text-muted-foreground/50 min-w-0"
                    placeholder={isFilament ? `Cor ${idx + 1} — ex: Preto Matte` : `Item ${idx + 1}`}
                    value={item.color}
                    onChange={e => updateItem(item.id, 'color', e.target.value)}
                  />

                  {/* Color hex picker */}
                  {isFilament ? (
                    <label className="cursor-pointer" title="Cor">
                      <span className="block size-7 rounded-full border-2 border-border/60 mx-auto"
                        style={{ backgroundColor: item.colorHex }} />
                      <input type="color" value={item.colorHex}
                        onChange={e => updateItem(item.id, 'colorHex', e.target.value)}
                        className="sr-only" />
                    </label>
                  ) : (
                    <div className="size-7 rounded-lg bg-muted/50 flex items-center justify-center mx-auto">
                      <Package className="size-3.5 text-muted-foreground" />
                    </div>
                  )}

                  {/* Weight */}
                  <input
                    type="number" min={1} step={isFilament ? 50 : 1}
                    className="text-sm text-center rounded-md border border-border/50 bg-background px-2 py-1 outline-none focus:border-orange-500 w-full"
                    value={item.weightG}
                    onChange={e => updateItem(item.id, 'weightG', +e.target.value)}
                  />

                  {/* Price */}
                  <CurrencyInput
                    value={item.priceUSD}
                    onChange={v => updateItem(item.id, 'priceUSD', v)}
                    className="text-sm text-center rounded-md border border-border/50 bg-background px-2 py-1 outline-none focus:border-orange-500 w-full h-auto"
                  />

                  {/* Remove */}
                  <button type="button"
                    onClick={() => removeItem(item.id)}
                    disabled={items.length === 1}
                    className="text-muted-foreground hover:text-red-400 disabled:opacity-20 transition-colors mx-auto"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addItem}
              className="w-full flex items-center justify-center gap-1.5 text-xs text-orange-500 hover:text-orange-600 border border-dashed border-orange-500/30 hover:border-orange-500/60 rounded-lg py-2 transition-colors"
            >
              <Plus className="size-3.5" />
              Adicionar item
            </button>
          </div>

          {/* Summary banner */}
          {items.length > 1 && (
            <div className="rounded-xl bg-orange-500/5 border border-orange-500/20 px-4 py-3 flex items-center justify-between">
              <div className="text-sm">
                <span className="font-semibold text-orange-500">{items.length} itens</span>
                <span className="text-muted-foreground ml-2">
                  · {brand || '…'} {isFilament ? material : ''} · {items.reduce((s, i) => s + i.weightG, 0).toLocaleString()}{unit} total
                </span>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Valor total</p>
                <p className="font-bold text-orange-500">{fmtCurrency(totalCost)}</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t border-border shrink-0 space-y-3">
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 rounded-lg border border-border py-2.5 text-sm hover:bg-muted transition-colors">
              {t.common.cancel}
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium py-2.5 transition-colors flex items-center justify-center gap-2">
              {saving
                ? <><div className="size-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Salvando…</>
                : <><ShoppingCart className="size-4" /> Salvar {items.length} {items.length === 1 ? 'item' : 'itens'}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
