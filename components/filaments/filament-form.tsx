'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CurrencyInput } from '@/components/ui/currency-input'
import { type FilamentSpool, MATERIAL_GROUPS, type MaterialCategory, type MaterialUnit } from '@/lib/filament-types'
import { useT } from '@/lib/i18n'

interface Props {
  initial: FilamentSpool | null
  onSave: (data: FilamentSpool) => void
  onClose: () => void
  saving?: boolean
  partners?: { name: string }[]
}

const CATEGORIES: MaterialCategory[] = ['Filament', 'Tool', 'Packaging', 'Accessory', 'Other']
const UNITS: MaterialUnit[] = ['g', 'kg', 'units', 'm', 'ml']

const BLANK: Omit<FilamentSpool, 'id'> = {
  category: 'Filament',
  unit: 'g',
  brand: '',
  material: 'PLA',
  color: '',
  colorHex: '#ff6b35',
  weightG: 1000,
  remainingG: 1000,
  priceUSD: 20,
  purchasedAt: new Date().toISOString().slice(0, 10),
  notes: '',
  paidBy: 'company',
}

export function FilamentForm({ initial, onSave, onClose, saving, partners = [] }: Props) {
  const { t, fmtCurrency, currencySymbol } = useT()
  const m = t.materials

  const [form, setForm] = useState<Omit<FilamentSpool, 'id'>>(
    initial ? { ...initial } : { ...BLANK }
  )

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm(prev => ({ ...prev, [k]: v }))

  const isFilament = (form.category ?? 'Filament') === 'Filament'

  function submit(e: React.FormEvent) {
    e.preventDefault()
    onSave({ ...form, id: initial?.id ?? '' })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <form
        onSubmit={submit}
        className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-background shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{initial ? m.editItem : m.addSpool}</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="size-5" />
          </button>
        </div>

        {/* Category */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{m.category}</Label>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => set('category', cat)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  (form.category ?? 'Filament') === cat
                    ? 'border-blue-600 bg-blue-600/10 text-blue-600'
                    : 'border-border text-muted-foreground hover:border-blue-600/40'
                }`}
              >
                {m.categories[cat]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Brand */}
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="brand" className="text-xs text-muted-foreground">{m.brand}</Label>
            <Input id="brand" value={form.brand} onChange={e => set('brand', e.target.value)}
              placeholder="e.g. Bambu Lab, eSUN" required />
          </div>

          {/* Name/Color */}
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="color" className="text-xs text-muted-foreground">{m.itemName}</Label>
            <div className="flex gap-2">
              <Input id="color" value={form.color} onChange={e => set('color', e.target.value)}
                placeholder={isFilament ? 'e.g. Matte Black' : 'e.g. Scissors 8cm'} className="flex-1" required />
              {isFilament && (
                <input
                  type="color"
                  value={form.colorHex}
                  onChange={e => set('colorHex', e.target.value)}
                  className="size-9 rounded-md border border-input cursor-pointer bg-background shrink-0 p-0.5"
                  title="Pick color"
                />
              )}
            </div>
          </div>

          {/* Material (filament only) */}
          {isFilament && (
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="material" className="text-xs text-muted-foreground">{m.material}</Label>
              <select
                id="material"
                value={form.material}
                onChange={e => set('material', e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
              >
                {MATERIAL_GROUPS.map(group => (
                  <optgroup key={group.label} label={group.label}>
                    {group.items.map(mat => <option key={mat} value={mat}>{mat}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
          )}

          {/* Unit */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{m.unit}</Label>
            <select
              value={form.unit ?? 'g'}
              onChange={e => set('unit', e.target.value as MaterialUnit)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
            >
              {UNITS.map(u => <option key={u} value={u}>{m.units[u]}</option>)}
            </select>
          </div>

          {/* Total qty */}
          <div className="space-y-1.5">
            <Label htmlFor="weightG" className="text-xs text-muted-foreground">
              {m.totalQty} ({form.unit ?? 'g'})
            </Label>
            <Input id="weightG" type="number" min={0} step={isFilament ? 50 : 1}
              value={form.weightG} onChange={e => set('weightG', +e.target.value)} />
          </div>

          {/* Remaining */}
          <div className="space-y-1.5">
            <Label htmlFor="remainingG" className="text-xs text-muted-foreground">
              {m.remainingQty} ({form.unit ?? 'g'})
            </Label>
            <Input id="remainingG" type="number" min={0} step={1}
              value={form.remainingG} onChange={e => set('remainingG', +e.target.value)} />
          </div>

          {/* Price */}
          <div className="space-y-1.5">
            <Label htmlFor="priceUSD" className="text-xs text-muted-foreground">{m.purchasePrice} ({currencySymbol})</Label>
            <CurrencyInput
              id="priceUSD"
              value={form.priceUSD}
              onChange={v => set('priceUSD', v)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label htmlFor="purchasedAt" className="text-xs text-muted-foreground">{m.purchaseDate}</Label>
            <Input id="purchasedAt" type="date"
              value={form.purchasedAt ?? ''} onChange={e => set('purchasedAt', e.target.value)} />
          </div>

          {/* Notes */}
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="notes" className="text-xs text-muted-foreground">{t.common.notes}</Label>
            <Input id="notes" value={form.notes ?? ''} onChange={e => set('notes', e.target.value)}
              placeholder={t.common.optional} />
          </div>
        </div>

        {/* Cost preview */}
        {form.priceUSD > 0 && form.weightG > 0 && (
          <div className="rounded-lg bg-muted/50 px-4 py-2.5 flex justify-between text-sm">
            <span className="text-muted-foreground">{m.costPreview}</span>
            <span className="font-mono font-semibold text-blue-600">
              {fmtCurrency(form.priceUSD / form.weightG)}/{form.unit ?? 'g'}
            </span>
          </div>
        )}

        {/* Paid by — only relevant on new items (expense is created on insert) */}
        {!initial && (
          <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pagamento</Label>

            {/* Company / Partner toggle */}
            <div className="flex gap-2">
              {(['company', 'partner'] as const).map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => set('paidBy', opt)}
                  className={`flex-1 py-1.5 rounded-md border text-xs font-medium transition-colors ${
                    (form.paidBy ?? 'company') === opt
                      ? 'border-blue-600 bg-blue-600/10 text-blue-600'
                      : 'border-border text-muted-foreground hover:border-blue-600/40'
                  }`}
                >
                  {opt === 'company' ? '🏢 Empresa' : '🤝 Sócio'}
                </button>
              ))}
            </div>

            {/* Partner details — show when partner is selected */}
            {form.paidBy === 'partner' && (
              <div className="grid grid-cols-2 gap-2">
                {/* Partner name dropdown */}
                <div className="col-span-2 space-y-1">
                  <label className="text-[11px] text-muted-foreground">Sócio</label>
                  {partners.length > 0 ? (
                    <select
                      value={form.paidByName ?? ''}
                      onChange={e => set('paidByName', e.target.value)}
                      className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-600"
                    >
                      <option value="">Selecionar sócio…</option>
                      {partners.map(p => (
                        <option key={p.name} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={form.paidByName ?? ''}
                      onChange={e => set('paidByName', e.target.value)}
                      placeholder="Nome do sócio"
                      className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-600"
                    />
                  )}
                </div>
                {/* Amount paid */}
                <div className="col-span-2 space-y-1">
                  <label className="text-[11px] text-muted-foreground">Valor pago</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.paidByAmount ?? form.priceUSD}
                    onChange={e => set('paidByAmount', parseFloat(e.target.value) || 0)}
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>
            )}

            {form.priceUSD > 0 && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <span className="size-3 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center text-[9px]">✓</span>
                Despesa registrada automaticamente.
                {form.paidBy === 'partner' && form.paidByName && ' Pagamento do sócio também será registrado.'}
              </p>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 rounded-md border border-border py-2 text-sm hover:bg-muted transition-colors">
            {t.common.cancel}
          </button>
          <button type="submit" disabled={saving}
            className="flex-1 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 text-sm font-medium transition-colors">
            {saving ? t.common.saving : initial ? t.common.save : m.addSpool}
          </button>
        </div>
      </form>
    </div>
  )
}
