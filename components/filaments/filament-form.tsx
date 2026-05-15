'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { type FilamentSpool, MATERIALS } from '@/lib/filament-types'

interface Props {
  initial: FilamentSpool | null
  onSave: (data: FilamentSpool) => void
  onClose: () => void
}

const BLANK: Omit<FilamentSpool, 'id'> = {
  brand: '',
  material: 'PLA',
  color: '',
  colorHex: '#ff6b35',
  weightG: 1000,
  remainingG: 1000,
  priceUSD: 20,
  purchasedAt: new Date().toISOString().slice(0, 10),
  notes: '',
}

export function FilamentForm({ initial, onSave, onClose }: Props) {
  const [form, setForm] = useState<Omit<FilamentSpool, 'id'>>(
    initial ? { ...initial } : { ...BLANK }
  )

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm(prev => ({ ...prev, [k]: v }))

  function submit(e: React.FormEvent) {
    e.preventDefault()
    onSave({ ...form, id: initial?.id ?? '' })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <form
        onSubmit={submit}
        className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-background shadow-2xl p-6 space-y-5"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{initial ? 'Edit spool' : 'Add spool'}</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="size-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Brand */}
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="brand" className="text-xs text-muted-foreground">Brand</Label>
            <Input id="brand" value={form.brand} onChange={e => set('brand', e.target.value)}
              placeholder="e.g. Bambu Lab, eSUN, Hatchbox" required />
          </div>

          {/* Material */}
          <div className="space-y-1.5">
            <Label htmlFor="material" className="text-xs text-muted-foreground">Material</Label>
            <select
              id="material"
              value={form.material}
              onChange={e => set('material', e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
            >
              {MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* Color name + swatch */}
          <div className="space-y-1.5">
            <Label htmlFor="color" className="text-xs text-muted-foreground">Color</Label>
            <div className="flex gap-2">
              <Input id="color" value={form.color} onChange={e => set('color', e.target.value)}
                placeholder="e.g. Matte Black" className="flex-1" required />
              <input
                type="color"
                value={form.colorHex}
                onChange={e => set('colorHex', e.target.value)}
                className="size-9 rounded-md border border-input cursor-pointer bg-background shrink-0 p-0.5"
                title="Pick spool color"
              />
            </div>
          </div>

          {/* Spool weight */}
          <div className="space-y-1.5">
            <Label htmlFor="weightG" className="text-xs text-muted-foreground">Spool weight (g)</Label>
            <Input id="weightG" type="number" min={100} step={50}
              value={form.weightG} onChange={e => set('weightG', +e.target.value)} />
          </div>

          {/* Remaining */}
          <div className="space-y-1.5">
            <Label htmlFor="remainingG" className="text-xs text-muted-foreground">Remaining (g)</Label>
            <Input id="remainingG" type="number" min={0} step={1}
              value={form.remainingG} onChange={e => set('remainingG', +e.target.value)} />
          </div>

          {/* Price */}
          <div className="space-y-1.5">
            <Label htmlFor="priceUSD" className="text-xs text-muted-foreground">Purchase price ($)</Label>
            <Input id="priceUSD" type="number" min={0.01} step={0.5}
              value={form.priceUSD} onChange={e => set('priceUSD', +e.target.value)} />
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label htmlFor="purchasedAt" className="text-xs text-muted-foreground">Purchase date</Label>
            <Input id="purchasedAt" type="date"
              value={form.purchasedAt ?? ''} onChange={e => set('purchasedAt', e.target.value)} />
          </div>

          {/* Notes */}
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="notes" className="text-xs text-muted-foreground">Notes (optional)</Label>
            <Input id="notes" value={form.notes ?? ''} onChange={e => set('notes', e.target.value)}
              placeholder="e.g. for structural parts only" />
          </div>
        </div>

        {/* Cost per gram preview */}
        {form.priceUSD > 0 && form.weightG > 0 && (
          <div className="rounded-lg bg-muted/50 px-4 py-2.5 flex justify-between text-sm">
            <span className="text-muted-foreground">Cost per gram</span>
            <span className="font-mono font-semibold text-orange-500">
              ${(form.priceUSD / form.weightG).toFixed(4)}/g
            </span>
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 rounded-md border border-border py-2 text-sm hover:bg-muted transition-colors">
            Cancel
          </button>
          <button type="submit"
            className="flex-1 rounded-md bg-orange-500 hover:bg-orange-600 text-white py-2 text-sm font-medium transition-colors">
            {initial ? 'Save changes' : 'Add spool'}
          </button>
        </div>
      </form>
    </div>
  )
}
