'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MATERIALS } from '@/lib/filament-types'
import type { Product } from '@/lib/product-types'

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
          <h2 className="text-lg font-semibold">{initial ? 'Edit product' : 'Add product'}</h2>
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
            <Label className="text-xs text-muted-foreground">Description</Label>
            <Input value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="Short product description" />
          </div>

          {/* Material */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Material</Label>
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
            <Label className="text-xs text-muted-foreground">Tags (comma separated)</Label>
            <Input value={tagInput} onChange={e => setTagInput(e.target.value)}
              placeholder="desk, organizer, gift" />
          </div>

          {/* Weight */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Weight (g)</Label>
            <Input type="number" min={0.1} step={1} value={form.weightG}
              onChange={e => set('weightG', +e.target.value)} />
          </div>

          {/* Print hours */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Print time (h)</Label>
            <Input type="number" min={0.1} step={0.25} value={form.printHours}
              onChange={e => set('printHours', +e.target.value)} />
          </div>

          {/* Cost */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Production cost ($)</Label>
            <Input type="number" min={0} step={0.01} value={form.costUSD}
              onChange={e => set('costUSD', +e.target.value)} />
          </div>

          {/* Price */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Sale price ($)</Label>
            <Input type="number" min={0} step={0.5} value={form.priceUSD}
              onChange={e => set('priceUSD', +e.target.value)} />
          </div>
        </div>

        {/* Preview */}
        {form.priceUSD > 0 && (
          <div className="rounded-lg bg-muted/50 px-4 py-2.5 grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Profit</p>
              <p className="font-mono text-green-400">${(form.priceUSD - form.costUSD).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Margin</p>
              <p className="font-mono text-orange-500">{margin}%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">$/g</p>
              <p className="font-mono">${form.weightG ? (form.priceUSD / form.weightG).toFixed(3) : '—'}</p>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 rounded-md border border-border py-2 text-sm hover:bg-muted transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="flex-1 rounded-md bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-2 text-sm font-medium transition-colors">
            {saving ? 'Saving…' : initial ? 'Save changes' : 'Add product'}
          </button>
        </div>
      </form>
    </div>
  )
}
