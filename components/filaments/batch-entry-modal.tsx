'use client'

import { useState } from 'react'
import { X, Plus, Trash2, ShoppingCart, Package } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CurrencyInput } from '@/components/ui/currency-input'
import { MATERIALS, type MaterialCategory, type MaterialUnit } from '@/lib/filament-types'
import { batchUpsertFilaments } from '@/lib/actions/filaments'
import { useT } from '@/lib/i18n'

// ── Material options flat list for per-item selects ───────────
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

// ── Color name → hex lookup ───────────────────────────────────
// Each entry: [keywords (pt + en), hex]
const COLOR_MAP: [string[], string][] = [
  // Neutros
  [['preto', 'black', 'negro'],                         '#1C1C1C'],
  [['branco', 'white', 'blanc'],                        '#F5F5F5'],
  [['cinza escuro', 'dark gray', 'dark grey', 'charcoal', 'carvão'], '#555555'],
  [['cinza claro', 'light gray', 'light grey'],         '#C0C0C0'],
  [['cinza', 'gray', 'grey', 'prata fria'],             '#888888'],
  [['prata', 'silver', 'prateado'],                     '#AAAAAA'],
  [['transparente', 'natural', 'clear', 'translúcido', 'translucido'], '#D8E8F0'],
  // Vermelhos / Rosas
  [['vermelho escuro', 'dark red', 'bordô', 'bordeau', 'vinho', 'wine', 'maroon'], '#8B0000'],
  [['vermelho', 'red', 'rojo'],                         '#D32F2F'],
  [['coral'],                                           '#FF6F61'],
  [['salmão', 'salmon'],                                '#FA8072'],
  [['rosa claro', 'light pink', 'rosa bebê', 'baby pink'], '#F8BBD0'],
  [['rosa choque', 'hot pink', 'pink choque', 'magenta rosa'], '#FF1493'],
  [['rosa', 'pink'],                                    '#E91E63'],
  [['magenta', 'fúcsia', 'fucsia'],                     '#C2185B'],
  // Laranjas / Amarelos
  [['laranja escuro', 'dark orange', 'abóbora', 'pumpkin'], '#E65100'],
  [['laranja', 'orange'],                               '#FF6D00'],
  [['amarelo ouro', 'gold yellow', 'âmbar', 'amber'],   '#FFC107'],
  [['amarelo', 'yellow', 'amarillo'],                   '#FDD835'],
  [['creme', 'cream', 'marfim', 'ivory'],               '#FFF8E1'],
  [['bege', 'beige', 'areia', 'sand'],                  '#D4B896'],
  // Verdes
  [['verde lima', 'lime', 'verde neon', 'neon green'],  '#8BC34A'],
  [['verde militar', 'olive', 'oliva', 'army green'],   '#556B2F'],
  [['verde escuro', 'dark green', 'forest green'],      '#1B5E20'],
  [['verde menta', 'mint', 'menta'],                    '#A5D6A7'],
  [['verde', 'green', 'verde folha'],                   '#388E3C'],
  [['teal', 'verde azulado', 'petróleo'],               '#00796B'],
  // Azuis
  [['azul royal', 'royal blue'],                        '#1565C0'],
  [['azul marinho', 'navy', 'marine blue', 'marinho', 'azul escuro', 'dark blue'], '#0D1B4B'],
  [['azul celeste', 'sky blue', 'céu'],                 '#4FC3F7'],
  [['azul bebê', 'baby blue', 'azul claro', 'light blue'], '#BBDEFB'],
  [['azul elétrico', 'electric blue', 'azul neon'],     '#0D47A1'],
  [['ciano', 'cyan', 'aqua'],                           '#00BCD4'],
  [['azul', 'blue', 'azul médio'],                      '#1976D2'],
  [['índigo', 'indigo'],                                '#3F51B5'],
  // Roxos / Lilás
  [['roxo escuro', 'dark purple', 'uva', 'grape'],      '#4A148C'],
  [['violeta', 'violet'],                               '#7B1FA2'],
  [['roxo', 'purple'],                                  '#9C27B0'],
  [['lilás', 'lilas', 'lavanda', 'lavender'],           '#CE93D8'],
  // Marrons
  [['marrom escuro', 'dark brown', 'chocolate'],        '#4E342E'],
  [['marrom', 'brown', 'café', 'caramel', 'caramelo'],  '#795548'],
  [['terracota', 'terra', 'terra cotta'],               '#C4622D'],
  // Metálicos / Especiais
  [['dourado', 'gold', 'ouro'],                         '#FFD700'],
  [['bronze'],                                          '#CD7F32'],
  [['cobre', 'copper'],                                 '#B87333'],
]

function guessHex(colorName: string): string | null {
  const n = colorName.toLowerCase().trim()
  if (!n) return null
  // Try longest match first (e.g. "azul marinho" before "azul")
  const sorted = [...COLOR_MAP].sort((a, b) => {
    const aMax = Math.max(...a[0].map(k => k.length))
    const bMax = Math.max(...b[0].map(k => k.length))
    return bMax - aMax
  })
  for (const [keys, hex] of sorted) {
    if (keys.some(k => n.includes(k))) return hex
  }
  return null
}

interface BatchItem {
  id: string
  material: string     // ← now per-item
  color: string
  colorHex: string
  weightG: number
  priceUSD: number
  notes: string
}

function newItem(defaultWeight: number, defaultPrice: number, defaultMaterial = 'PLA'): BatchItem {
  return {
    id: crypto.randomUUID(),
    material: defaultMaterial,
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
const SELECT_CLS = 'rounded-md border border-border/60 bg-background px-2 py-1 text-xs outline-none focus:border-orange-500 transition-colors h-8 w-full'

export function BatchEntryModal({ onSaved, onClose }: Props) {
  const { t, fmtCurrency, currencySymbol } = useT()
  const m = t.materials

  // ── Shared fields ──────────────────────────────────────────
  const [category,      setCategory]     = useState<MaterialCategory>('Filament')
  const [brand,         setBrand]        = useState('')
  const [spoolWeightG,  setSpoolWeightG] = useState(1000)
  const [unit,          setUnit]         = useState<MaterialUnit>('g')
  const [purchasedAt,   setPurchasedAt]  = useState(new Date().toISOString().slice(0, 10))
  const [sharedPrice,   setSharedPrice]  = useState(0)
  const [applyPriceAll, setApplyPriceAll] = useState(true)

  // ── Items list ─────────────────────────────────────────────
  const [items, setItems] = useState<BatchItem[]>([newItem(1000, 0, 'PLA')])

  // ── Submission ─────────────────────────────────────────────
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const isFilament = category === 'Filament'
  const totalCost  = items.reduce((s, i) => s + i.priceUSD, 0)

  function addItem() {
    // New item inherits material from the last item for convenience
    const lastMaterial = items[items.length - 1]?.material ?? 'PLA'
    setItems(prev => [...prev, newItem(spoolWeightG, applyPriceAll ? sharedPrice : 0, lastMaterial)])
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
        material:     isFilament ? item.material : '',
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

          {/* Shared fields */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Marca *</Label>
              <input className={INPUT} placeholder="ex: Bambu Lab, eSUN, Creality"
                value={brand} onChange={e => setBrand(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Qtd padrão ({unit})</Label>
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
              <CurrencyInput value={sharedPrice} onChange={applySharedPrice} className={INPUT} />
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
            <div className="grid grid-cols-[130px_1fr_36px_90px_90px_32px] gap-2 px-3">
              <span className="text-[10px] text-muted-foreground">Tipo</span>
              <span className="text-[10px] text-muted-foreground">Cor / Nome</span>
              <span className="text-[10px] text-muted-foreground text-center">Cor</span>
              <span className="text-[10px] text-muted-foreground text-center">Qtd ({unit})</span>
              <span className="text-[10px] text-muted-foreground text-center">Preço ({currencySymbol})</span>
              <span />
            </div>

            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={item.id}
                  className="grid grid-cols-[130px_1fr_36px_90px_90px_32px] gap-2 items-center rounded-lg border border-border bg-muted/20 px-3 py-2">

                  {/* Material type — per item */}
                  {isFilament ? (
                    <select
                      value={item.material}
                      onChange={e => updateItem(item.id, 'material', e.target.value)}
                      className={SELECT_CLS}
                    >
                      {MATERIAL_GROUPS.map(group => (
                        <optgroup key={group.label} label={group.label}>
                          {group.items.map(mat => (
                            <option key={mat} value={mat}>{mat}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}

                  {/* Color name — auto-detects hex */}
                  <input
                    className="bg-transparent text-sm outline-none placeholder:text-muted-foreground/50 min-w-0"
                    placeholder={isFilament ? `Cor ${idx + 1}` : `Item ${idx + 1}`}
                    value={item.color}
                    onChange={e => {
                      const val = e.target.value
                      updateItem(item.id, 'color', val)
                      if (isFilament) {
                        const hex = guessHex(val)
                        if (hex) updateItem(item.id, 'colorHex', hex)
                      }
                    }}
                  />

                  {/* Color hex picker */}
                  {isFilament ? (
                    <label className="cursor-pointer" title={item.colorHex}>
                      <span className="block size-7 rounded-full border-2 border-border/60 mx-auto relative"
                        style={{ backgroundColor: item.colorHex }}>
                        {/* tiny sparkle when auto-detected */}
                        {guessHex(item.color) === item.colorHex && (
                          <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-orange-500 border border-background" />
                        )}
                      </span>
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
                  · {brand || '…'} · {items.reduce((s, i) => s + i.weightG, 0).toLocaleString()}{unit} total
                </span>
                {isFilament && (
                  <span className="text-muted-foreground ml-1">
                    · {[...new Set(items.map(i => i.material))].join(', ')}
                  </span>
                )}
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
