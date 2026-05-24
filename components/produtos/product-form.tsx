'use client'

import { useState, useEffect } from 'react'
import { X, Plus, Trash2, Clock, FlaskConical, Calculator } from 'lucide-react'
import Link from 'next/link'
import type { VolumeTier, ProductConsumable } from '@/lib/product-types'
import { totalConsumablesCost } from '@/lib/product-types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MATERIAL_GROUPS } from '@/lib/filament-types'
import type { Product } from '@/lib/product-types'
import { useT } from '@/lib/i18n'
import { CurrencyInput } from '@/components/ui/currency-input'
import { getUserPrinters } from '@/lib/actions/printers'
import { getConsumables, getProductConsumables, type ConsumableRow } from '@/lib/actions/consumables'

interface Props {
  initial: Product | null
  onSave: (p: Product) => void
  onClose: () => void
  saving?: boolean
}

type PrinterOption = {
  id: string
  name: string
  watts: number
  cph: number
  dailyRate: number
  workingHours: number
}

const BLANK: Omit<Product, 'id' | 'createdAt'> = {
  name: '',
  description: '',
  material: 'PLA',
  weightG: 50,
  printHours: 2,
  costUSD: 0,
  priceUSD: 0,
  tags: [],
  imageUrl: '',
  unitsPerRun: 1,
  batches: undefined,
  status: 'active',
  printerId: undefined,
  printerCount: 1,
  platesPerUnit: false,
}

export function ProductForm({ initial, onSave, onClose, saving }: Props) {
  const { t, fmtCurrency } = useT()
  const [form, setForm] = useState(
    initial
      ? { ...initial }
      : { ...BLANK, id: '', createdAt: new Date().toISOString().slice(0, 10) }
  )
  const [tagInput, setTagInput] = useState(initial?.tags.join(', ') ?? '')
  const [printers, setPrinters] = useState<PrinterOption[]>([])
  const [consumablesCatalog, setConsumablesCatalog] = useState<ConsumableRow[]>([])
  const [consumables, setConsumables] = useState<ProductConsumable[]>([])

  useEffect(() => {
    // Load printers
    getUserPrinters().then(rows => {
      const mapped = (rows ?? []).map((p: Record<string, unknown>) => ({
        id:           String(p.id),
        name:         String(p.name),
        watts:        Number(p.watts ?? 120),
        cph:          0,
        dailyRate:    Number(p.daily_rate ?? 0),
        workingHours: Number(p.working_hours_per_day ?? 20),
      }))
      setPrinters(mapped)
      if (mapped.length === 1 && !form.printerId) {
        setForm(prev => ({ ...prev, printerId: mapped[0].id }))
      }
    }).catch(() => {})

    // Load consumables catalog
    getConsumables().then(setConsumablesCatalog).catch(() => {})

    // Load existing product consumables when editing
    if (initial?.id) {
      getProductConsumables(initial.id).then(rows => {
        setConsumables(rows.map(r => ({
          consumableId:    r.consumable_id,
          name:            r.consumable.name,
          unit:            r.consumable.unit,
          costPerUnit:     r.consumable.cost_per_unit,
          quantityPerUnit: r.quantity_per_unit,
        })))
      }).catch(() => {})
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Local tier type with a stable ID for React keying
  type LocalTier = VolumeTier & { _id: string }
  const toLocal = (t: VolumeTier): LocalTier => ({ ...t, _id: crypto.randomUUID() })
  const [volumeTiers, setVolumeTiers] = useState<LocalTier[]>(
    (initial?.volumePrices ?? []).map(toLocal)
  )

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm(prev => ({ ...prev, [k]: v }))

  const margin = form.priceUSD > 0
    ? ((form.priceUSD - form.costUSD) / form.priceUSD * 100).toFixed(0)
    : '—'

  // Derived: selected printer + daily rate indicator
  const selectedPrinter  = printers.find(p => p.id === form.printerId) ?? null
  const printerCount     = Math.max(1, form.printerCount ?? 1)
  const effectiveHours   = form.printHours / printerCount
  const machineContrib   = selectedPrinter && selectedPrinter.dailyRate > 0
    ? effectiveHours * (selectedPrinter.dailyRate / selectedPrinter.workingHours) * printerCount
    : null

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const tags = tagInput.split(',').map(t => t.trim()).filter(Boolean)
    const cleanTiers: VolumeTier[] = volumeTiers.map(({ _id: _, ...rest }) => rest)
    onSave({
      ...form,
      tags,
      volumePrices: cleanTiers.length ? cleanTiers : undefined,
      printerCount: printerCount > 1 ? printerCount : undefined,
      consumables: consumables.length > 0 ? consumables : [],
    })
  }

  function addTier() {
    const nextQty = volumeTiers.length === 0
      ? 5
      : Math.max(...volumeTiers.map(t => t.minQty)) + 5
    setVolumeTiers(prev => [...prev, { _id: crypto.randomUUID(), minQty: nextQty, priceUSD: form.priceUSD * 0.9 }])
  }

  // ── Derived: consumables ──────────────────────────────────────
  const consumablesTotal = totalConsumablesCost(consumables)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <form
        onSubmit={submit}
        className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-background shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{initial ? t.common.edit : t.products.addProduct}</h2>
          <div className="flex items-center gap-2">
            {initial?.pricingSessionId && (
              <Link
                href={`/precificacao?session=${initial.pricingSessionId}`}
                onClick={onClose}
                className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-500 border border-blue-600/30 bg-blue-600/5 hover:bg-blue-600/10 px-2.5 py-1.5 rounded-lg transition-colors"
                title="Abrir cálculo de precificação deste produto"
              >
                <Calculator className="size-3.5" />
                Ver precificação
              </Link>
            )}
            <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="size-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Name */}
          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t.products.name ?? 'Nome do produto'}</Label>
            <Input value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="ex.: Suporte de Celular" required />
          </div>

          {/* Description */}
          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t.products.description}</Label>
            <Input value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="Breve descrição do produto" />
          </div>

          {/* Material */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t.products.material}</Label>
            <select
              value={form.material}
              onChange={e => set('material', e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
            >
              {MATERIAL_GROUPS.map(group => (
                <optgroup key={group.label} label={group.label}>
                  {group.items.map(m => <option key={m} value={m}>{m}</option>)}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t.products.tags}</Label>
            <Input value={tagInput} onChange={e => setTagInput(e.target.value)}
              placeholder="desk, organizer, gift" />
          </div>

          {/* Weight */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t.products.weightG}</Label>
            <Input type="number" min={0.1} step={1} value={form.weightG}
              onChange={e => set('weightG', +e.target.value)} />
          </div>

          {/* Print hours */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t.products.printHours}</Label>
            <Input type="number" min={0.1} step={0.25} value={form.printHours}
              onChange={e => set('printHours', +e.target.value)} />
          </div>

          {/* Units per plate + batch count — affect cost per unit */}
          <div className="col-span-2 rounded-lg border border-border bg-muted/20 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t.products.productionBatch}</p>
              {/* Mode toggle */}
              <div className="flex items-center gap-1 rounded-md border border-border overflow-hidden text-[10px]">
                <button type="button"
                  onClick={() => set('platesPerUnit', false)}
                  className={`px-2 py-1 transition-colors ${!(form.platesPerUnit) ? 'bg-blue-600 text-white font-medium' : 'text-muted-foreground hover:bg-muted'}`}>
                  N un/chapa
                </button>
                <button type="button"
                  onClick={() => set('platesPerUnit', true)}
                  className={`px-2 py-1 transition-colors ${form.platesPerUnit ? 'bg-blue-600 text-white font-medium' : 'text-muted-foreground hover:bg-muted'}`}>
                  N chapas/un
                </button>
              </div>
            </div>

            {form.platesPerUnit ? (
              /* Plates-per-unit mode: large multi-part objects */
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Chapas necessárias por unidade</Label>
                  <Input type="number" min={1} step={1}
                    value={form.batches ?? 1}
                    onChange={e => set('batches', Math.max(1, +e.target.value))} />
                </div>
                <p className="text-[11px] text-muted-foreground/70 flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-blue-500 shrink-0" />
                  Cada unidade requer {form.batches ?? 1} impressão{(form.batches ?? 1) > 1 ? 'ões' : ''} completa{(form.batches ?? 1) > 1 ? 's' : ''}.
                  O custo será multiplicado por {form.batches ?? 1}.
                </p>
              </div>
            ) : (
              /* Units-per-plate mode: small stackable objects */
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t.products.unitsPerPlate}</Label>
                    <Input type="number" min={1} step={1} value={form.unitsPerRun ?? 1}
                      onChange={e => {
                        const newUnits = Math.max(1, +e.target.value)
                        const plateCost = form.costUSD * (form.unitsPerRun ?? 1)
                        setForm(prev => ({ ...prev, unitsPerRun: newUnits, costUSD: parseFloat((plateCost / newUnits).toFixed(4)) }))
                      }} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t.products.numPlates}</Label>
                    <Input type="number" min={1} step={1}
                      value={form.batches ?? ''}
                      placeholder="—"
                      onChange={e => set('batches', e.target.value ? Math.max(1, +e.target.value) : undefined)} />
                  </div>
                </div>
                {form.costUSD > 0 && (form.unitsPerRun ?? 1) > 1 && (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-blue-500 shrink-0" />
                    {t.products.plateCost}: <span className="font-semibold text-foreground ml-0.5">{fmtCurrency(form.costUSD * (form.unitsPerRun ?? 1))}</span>
                    <span className="text-muted-foreground/60">÷ {form.unitsPerRun} = {fmtCurrency(form.costUSD)}/un</span>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Printer assignment */}
          <div className="col-span-2 rounded-lg border border-border bg-muted/20 p-3 space-y-2.5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="size-3 text-blue-600" /> Impressora &amp; paralelismo
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Impressora</Label>
                <select
                  value={form.printerId ?? ''}
                  onChange={e => set('printerId', e.target.value || undefined)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
                >
                  <option value="">— nenhuma —</option>
                  {printers.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Impressoras em paralelo</Label>
                <Input
                  type="number" min={1} max={10} step={1}
                  value={form.printerCount ?? 1}
                  onChange={e => set('printerCount', Math.max(1, +e.target.value))}
                />
              </div>
            </div>

            {/* Print time indicator */}
            <div className="rounded-md px-3 py-2 text-xs flex items-start gap-2 bg-muted/40">
              <Clock className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p>
                  Tempo efetivo:{' '}
                  <strong>{effectiveHours % 1 === 0 ? effectiveHours : effectiveHours.toFixed(1)}h</strong>
                  {printerCount > 1 && (
                    <span className="text-muted-foreground">
                      {' '}({form.printHours}h ÷ {printerCount} impressoras)
                    </span>
                  )}
                </p>
                {machineContrib !== null && (
                  <p>
                    Custo máquina:{' '}
                    <strong className="text-blue-500">${machineContrib.toFixed(2)}</strong>
                    <span className="text-muted-foreground">
                      {' '}(${selectedPrinter!.dailyRate}/dia · {selectedPrinter!.workingHours}h/dia)
                    </span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Consumables / Post-processing */}
          <ConsumablesSection
            catalog={consumablesCatalog}
            items={consumables}
            onChange={setConsumables}
          />

          {/* Cost */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t.products.costUSD} (filamento, por unidade)</Label>
            <CurrencyInput
              value={form.costUSD}
              onChange={v => set('costUSD', v)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {/* Price */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t.products.priceUSD}</Label>
            <CurrencyInput
              value={form.priceUSD}
              onChange={v => set('priceUSD', v)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>

        {/* Preview */}
        {form.priceUSD > 0 && (
          <div className="rounded-lg bg-muted/50 px-4 py-2.5 space-y-2 text-sm">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Lucro</p>
                <p className="font-mono text-green-400">{fmtCurrency(form.priceUSD - form.costUSD - consumablesTotal)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Margem</p>
                <p className="font-mono text-blue-600">{margin}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">$/g</p>
                <p className="font-mono">{form.weightG ? fmtCurrency(form.priceUSD / form.weightG) : '—'}</p>
              </div>
            </div>
            {consumablesTotal > 0 && (
              <div className="pt-1 border-t border-border/50 flex justify-between text-xs text-muted-foreground">
                <span>Custo total (filamento + consumíveis)</span>
                <span className="font-mono font-medium text-foreground">
                  {fmtCurrency(form.costUSD + consumablesTotal)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Volume pricing tiers */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Preço por volume</Label>
            <button type="button" onClick={addTier}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-500 transition-colors">
              <Plus className="size-3" /> Adicionar faixa
            </button>
          </div>

          {volumeTiers.length === 0 && (
            <p className="text-[11px] text-muted-foreground/60 italic">
              Nenhuma faixa de volume. Clique em &quot;Adicionar faixa&quot; para oferecer desconto por quantidade.
            </p>
          )}

          {[...volumeTiers].sort((a, b) => a.minQty - b.minQty).map((tier) => {
            const discountPct = form.priceUSD > 0
              ? ((form.priceUSD - tier.priceUSD) / form.priceUSD * 100)
              : 0
            return (
              <div key={tier._id} className="grid grid-cols-[80px_1fr_56px_24px] gap-2 items-center">
                <div className="space-y-0.5">
                  <Label className="text-[10px] text-muted-foreground">A partir de</Label>
                  <input
                    type="number" min={2} step={1}
                    value={tier.minQty}
                    onChange={e => setVolumeTiers(prev => prev.map(t => t._id === tier._id ? { ...t, minQty: +e.target.value } : t))}
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <div className="space-y-0.5">
                  <Label className="text-[10px] text-muted-foreground">Preço/un</Label>
                  <input
                    type="number" min={0} step="any"
                    value={tier.priceUSD}
                    onChange={e => setVolumeTiers(prev => prev.map(t => t._id === tier._id ? { ...t, priceUSD: parseFloat(e.target.value) || 0 } : t))}
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <span className={`text-xs font-medium text-right tabular-nums ${discountPct > 0 ? 'text-green-400' : 'text-muted-foreground'}`}>
                  {discountPct > 0 ? `-${discountPct.toFixed(0)}%` : '—'}
                </span>
                <button type="button"
                  onClick={() => setVolumeTiers(prev => prev.filter(t => t._id !== tier._id))}
                  className="text-muted-foreground hover:text-red-400 transition-colors">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            )
          })}
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 rounded-md border border-border py-2 text-sm hover:bg-muted transition-colors">
            {t.common.cancel}
          </button>
          <button type="submit" disabled={saving}
            className="flex-1 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 text-sm font-medium transition-colors">
            {saving ? t.common.saving : initial ? t.common.save : t.products.addProduct}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Consumables section ────────────────────────────────────────
function ConsumablesSection({
  catalog,
  items,
  onChange,
}: {
  catalog: ConsumableRow[]
  items: ProductConsumable[]
  onChange: (items: ProductConsumable[]) => void
}) {
  const total = items.reduce((s, c) => s + c.quantityPerUnit * c.costPerUnit, 0)

  function addItem(consumableId: string) {
    const c = catalog.find(c => c.id === consumableId)
    if (!c) return
    if (items.some(i => i.consumableId === consumableId)) return
    onChange([...items, {
      consumableId,
      name:            c.name,
      unit:            c.unit,
      costPerUnit:     c.cost_per_unit,
      quantityPerUnit: 1,
    }])
  }

  function updateQty(consumableId: string, qty: number) {
    onChange(items.map(i => i.consumableId === consumableId ? { ...i, quantityPerUnit: qty } : i))
  }

  function removeItem(consumableId: string) {
    onChange(items.filter(i => i.consumableId !== consumableId))
  }

  const available = catalog.filter(c => !items.some(i => i.consumableId === c.id))

  return (
    <div className="col-span-2 rounded-lg border border-border bg-muted/20 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <FlaskConical className="size-3 text-blue-600" /> Pós-processamento
        </p>
        {total > 0 && (
          <span className="text-[10px] font-mono text-blue-500 font-medium">
            +${total.toFixed(2)}/un
          </span>
        )}
      </div>

      {items.length > 0 && (
        <div className="space-y-1.5">
          {items.map(item => (
            <div key={item.consumableId} className="grid grid-cols-[1fr_90px_auto] gap-2 items-center">
              <div className="text-xs truncate">
                <span className="font-medium">{item.name}</span>
                <span className="text-muted-foreground ml-1">${item.costPerUnit.toFixed(4)}/{item.unit}</span>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number" min={0.001} step={0.1}
                  value={item.quantityPerUnit}
                  onChange={e => updateQty(item.consumableId, Math.max(0.001, +e.target.value))}
                  className="w-14 h-7 rounded border border-input bg-background px-2 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-[10px] text-muted-foreground">{item.unit}</span>
              </div>
              <button type="button" onClick={() => removeItem(item.consumableId)}
                className="text-muted-foreground hover:text-red-400 transition-colors">
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {available.length > 0 && (
        <select
          value=""
          onChange={e => { addItem(e.target.value); e.target.value = '' }}
          className="w-full h-7 rounded border border-dashed border-border bg-background px-2 text-xs text-muted-foreground focus:outline-none focus:border-blue-600 cursor-pointer"
        >
          <option value="">+ Adicionar material…</option>
          {available.map(c => (
            <option key={c.id} value={c.id}>
              {c.name} — ${c.cost_per_unit.toFixed(4)}/{c.unit}
            </option>
          ))}
        </select>
      )}

      {catalog.length === 0 && (
        <p className="text-[11px] text-muted-foreground/60 italic">
          Nenhum consumível cadastrado.{' '}
          <a href="/consumables" target="_blank" className="text-blue-500 hover:underline">
            Cadastrar materiais →
          </a>
        </p>
      )}
    </div>
  )
}
