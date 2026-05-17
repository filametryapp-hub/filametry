'use client'

import { useState, useEffect } from 'react'
import { Plus, Layers, Pencil, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { FilamentForm } from './filament-form'
import { getFilaments, upsertFilament, deleteFilament } from '@/lib/actions/filaments'
import { useT } from '@/lib/i18n'
import {
  type FilamentSpool,
  type MaterialCategory,
  costPerGram,
  remainingPct,
  remainingValue,
} from '@/lib/filament-types'

// Map DB row (snake_case) → FilamentSpool (camelCase)
function fromRow(row: Record<string, unknown>): FilamentSpool {
  return {
    id:          String(row.id),
    brand:       String(row.brand),
    material:    String(row.material ?? ''),
    color:       String(row.color),
    colorHex:    String(row.color_hex ?? '#ff6b35'),
    weightG:     Number(row.weight_g),
    remainingG:  Number(row.remaining_g),
    priceUSD:    Number(row.price_usd),
    purchasedAt: row.purchased_at ? String(row.purchased_at) : undefined,
    notes:       row.notes ? String(row.notes) : undefined,
    category:    (row.category as MaterialCategory) ?? 'Filament',
    unit:        (row.unit as import('@/lib/filament-types').MaterialUnit) ?? 'g',
  }
}

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
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
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

      <Badge variant="secondary" className="text-xs">{spool.material}</Badge>

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Remaining</span>
          <span className="font-mono">{spool.remainingG}{spool.unit ?? 'g'} / {spool.weightG}{spool.unit ?? 'g'}</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${pctColor(pct)}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground text-right">{pct.toFixed(0)}% left</p>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border">
        <div>
          <p className="text-xs text-muted-foreground">Cost/{spool.unit ?? 'g'}</p>
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
  const { t } = useT()
  const m = t.materials
  const [spools, setSpools]   = useState<FilamentSpool[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [editing, setEditing]     = useState<FilamentSpool | null>(null)
  const [saving, setSaving]       = useState(false)

  async function load() {
    setLoading(true)
    try {
      const rows = await getFilaments()
      setSpools((rows ?? []).map(r => fromRow(r as Record<string, unknown>)))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const totalValue  = spools.reduce((s, sp) => s + remainingValue(sp), 0)
  const totalWeight = spools.reduce((s, sp) => s + sp.remainingG, 0)

  async function save(data: FilamentSpool) {
    setSaving(true)
    try {
      await upsertFilament({
        id:           data.id || undefined,
        brand:        data.brand,
        material:     data.material,
        color:        data.color,
        color_hex:    data.colorHex,
        weight_g:     data.weightG,
        remaining_g:  data.remainingG,
        price_usd:    data.priceUSD,
        purchased_at: data.purchasedAt,
        notes:        data.notes,
        category:     data.category ?? 'Filament',
        unit:         data.unit ?? 'g',
      })
      await load()
    } finally {
      setSaving(false)
      setEditing(null)
      setShowForm(false)
    }
  }

  async function remove(id: string) {
    await deleteFilament(id)
    setSpools(prev => prev.filter(s => s.id !== id))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="size-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: m.items,          value: spools.length.toString() },
          { label: m.totalRemaining, value: `${totalWeight.toLocaleString()}` },
          { label: m.inventoryValue, value: fmt(totalValue) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-border bg-card px-5 py-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{m.itemsInStock(spools.length)}</p>
        <button
          onClick={() => { setEditing(null); setShowForm(true) }}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
        >
          <Plus className="size-4" /> {m.addItem}
        </button>
      </div>

      {/* Grid */}
      {spools.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <Layers className="size-8 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-sm text-muted-foreground">{m.noItems}</p>
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
          saving={saving}
        />
      )}
    </div>
  )
}
