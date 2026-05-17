'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MATERIALS } from '@/lib/filament-types'
import type { Product } from '@/lib/product-types'
import { useT } from '@/lib/i18n'
import { CurrencyInput } from '@/components/ui/currency-input'

interface Props {
  initial: Product | null
  onSave: (p: Product) => void
  onClose: () => void
  saving?: boolean
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
}

export function ProductForm({ initial, onSave, onClose, saving }: Props) {
  const { t, fmtCurrency } = useT()
  const [form, setForm] = useState(
    initial
      ? { ...initial }
      : { ...BLANK, id: '', createdAt: new Date().toISOString().slice(0, 10) }
  )
  const [tagInput, setTagInput] = useState(initial?.tags.join(', ') ?? '')

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm(prev => ({ ...prev, [k]: v }))

  const margin = form.priceUSD > 0
    ? ((form.priceUSD - form.costUSD) / form.priceUSD * 100).toFixed(0)
    : '—'

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const tags = tagInput.split(',').map(t => t.trim()).filter(Boolean)
    onSave({ ...form, tags })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <form
        onSubmit={submit}
        className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-background shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{initial ? t.common.edit : t.products.addProduct}</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Name */}
          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs text-muted-foreground">Product name</Label>
            <Input value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="e.g. Phone Stand" required />
          </div>

          {/* Description */}
          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t.products.description}</Label>
            <Input value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="Short product description" />
          </div>

          {/* Material */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t.products.material}</Label>
            <select
              value={form.material}
              onChange={e => set('material', e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
            >
              {MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
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

          {/* Cost */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t.products.costUSD}</Label>
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
          <div className="rounded-lg bg-muted/50 px-4 py-2.5 grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Profit</p>
              <p className="font-mono text-green-400">{fmtCurrency(form.priceUSD - form.costUSD)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Margin</p>
              <p className="font-mono text-orange-500">{margin}%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">$/g</p>
              <p className="font-mono">{form.weightG ? fmtCurrency(form.priceUSD / form.weightG) : '—'}</p>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 rounded-md border border-border py-2 text-sm hover:bg-muted transition-colors">
            {t.common.cancel}
          </button>
          <button type="submit" disabled={saving}
            className="flex-1 rounded-md bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-2 text-sm font-medium transition-colors">
            {saving ? t.common.saving : initial ? t.common.save : t.products.addProduct}
          </button>
        </div>
      </form>
    </div>
  )
}
