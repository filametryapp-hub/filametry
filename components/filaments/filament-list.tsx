'use client'

import { useState } from 'react'
import { Plus, Layers, Pencil, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { FilamentForm } from './filament-form'
import {
  type FilamentSpool,
  costPerGram,
  remainingPct,
  remainingValue,
} from '@/lib/filament-types'

// Demo data so the UI is useful out of the box
const DEMO: FilamentSpool[] = [
  {
    id: '1',
    brand: 'Bambu Lab',
    material: 'PLA Matte',
    color: 'Matte Black',
    colorHex: '#1a1a1a',
    weightG: 1000,
    remainingG: 780,
    priceUSD: 20,
    purchasedAt: '2025-03-01',
  },
  {
    id: '2',
    brand: 'Bambu Lab',
    material: 'ABS',
    color: 'White',
    colorHex: '#f5f5f5',
    weightG: 1000,
    remainingG: 420,
    priceUSD: 22,
    purchasedAt: '2025-02-15',
  },
  {
    id: '3',
    brand: 'eSUN',
    material: 'PETG',
    color: 'Transparent Blue',
    colorHex: '#3b82f6',
    weightG: 1000,
    remainingG: 1000,
    priceUSD: 18,
    purchasedAt: '2025-04-10',
  },
]

function pctColor(pct: number) {
  if (pct > 50) return 'bg-green-500'
  if (pct > 20) return 'bg-yellow-500'
  return 'bg-red-500'
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
}

function SpoolCard({ spool, onEdit, onDelete }: {
  spool: FilamentSpool
  onEdit: () => void
  onDelete: () => void
}) {
  const pct = remainingPct(spool)

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Color swatch */}
          <div
            className="size-10 rounded-lg border border-border shrink-0"
            style={{ backgroundColor: spool.colorHex }}
          />
          <div>
            <p className="font-semibold text-sm leading-tight">{spool.brand}</p>
            <p className="text-xs text-muted-foreground">{spool.color}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Material badge */}
      <Badge variant="secondary" className="text-xs">{spool.material}</Badge>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Remaining</span>
          <span className="font-mono">{spool.remainingG}g / {spool.weightG}g</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${pctColor(pct)}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground text-right">{pct.toFixed(0)}% left</p>
      </div>

      {/* Cost info */}
      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border">
        <div>
          <p className="text-xs text-muted-foreground">Cost/g</p>
          <p className="text-sm font-mono font-semibold">{fmt(costPerGram(spool))}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Value left</p>
          <p className="text-sm font-mono font-semibold">{fmt(remainingValue(spool))}</p>
        </div>
      </div>
    </div>
  )
}

export function FilamentList() {
  const [spools, setSpools] = useState<FilamentSpool[]>(DEMO)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<FilamentSpool | null>(null)

  const totalValue = spools.reduce((s, sp) => s + remainingValue(sp), 0)
  const totalWeight = spools.reduce((s, sp) => s + sp.remainingG, 0)

  function save(data: FilamentSpool) {
    if (editing) {
      setSpools(prev => prev.map(s => s.id === data.id ? data : s))
    } else {
      setSpools(prev => [...prev, { ...data, id: crypto.randomUUID() }])
    }
    setEditing(null)
    setShowForm(false)
  }

  function remove(id: string) {
    setSpools(prev => prev.filter(s => s.id !== id))
  }

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Spools',          value: spools.length.toString() },
          { label: 'Total remaining', value: `${totalWeight.toLocaleString()}g` },
          { label: 'Inventory value', value: fmt(totalValue) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-border bg-card px-5 py-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{spools.length} spool{spools.length !== 1 ? 's' : ''} in inventory</p>
        <button
          onClick={() => { setEditing(null); setShowForm(true) }}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
        >
          <Plus className="size-4" /> Add spool
        </button>
      </div>

      {/* Grid */}
      {spools.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <Layers className="size-8 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-sm text-muted-foreground">No spools yet. Add your first filament.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {spools.map(spool => (
            <SpoolCard
              key={spool.id}
              spool={spool}
              onEdit={() => { setEditing(spool); setShowForm(true) }}
              onDelete={() => remove(spool.id)}
            />
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <FilamentForm
          initial={editing}
          onSave={save}
          onClose={() => { setShowForm(false); setEditing(null) }}
        />
      )}
    </div>
  )
}
