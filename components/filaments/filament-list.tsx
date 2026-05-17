'use client'

import { useState, useEffect } from 'react'
import { Plus, Layers, Pencil, Trash2, ChevronDown, ChevronUp, Wallet, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { FilamentForm } from './filament-form'
import { getFilaments, upsertFilament, deleteFilament, addMaterialPayment, deleteMaterialPayment } from '@/lib/actions/filaments'
import { useT } from '@/lib/i18n'
import {
  type FilamentSpool,
  type MaterialCategory,
  costPerGram,
  remainingPct,
  remainingValue,
} from '@/lib/filament-types'

type MaterialPayment = {
  id: string
  payer_name: string
  amount_paid: number
  paid_at: string
  notes?: string
}

type SpoolWithPayments = FilamentSpool & {
  material_payments: MaterialPayment[]
  price_usd_raw: number
}

// Map DB row (snake_case) → SpoolWithPayments
function fromRow(row: Record<string, unknown>): SpoolWithPayments {
  return {
    id:            String(row.id),
    brand:         String(row.brand),
    material:      String(row.material ?? ''),
    color:         String(row.color),
    colorHex:      String(row.color_hex ?? '#ff6b35'),
    weightG:       Number(row.weight_g),
    remainingG:    Number(row.remaining_g),
    priceUSD:      Number(row.price_usd),
    price_usd_raw: Number(row.price_usd),
    purchasedAt:   row.purchased_at ? String(row.purchased_at) : undefined,
    notes:         row.notes ? String(row.notes) : undefined,
    category:      (row.category as MaterialCategory) ?? 'Filament',
    unit:          (row.unit as import('@/lib/filament-types').MaterialUnit) ?? 'g',
    material_payments: Array.isArray(row.material_payments)
      ? (row.material_payments as MaterialPayment[])
      : [],
  }
}

function pctColor(pct: number) {
  if (pct > 50) return 'bg-green-500'
  if (pct > 20) return 'bg-yellow-500'
  return 'bg-red-500'
}

function PaymentPanel({ spool, onRefresh }: { spool: SpoolWithPayments; onRefresh: () => void }) {
  const { fmtCurrency } = useT()
  const totalPaid   = spool.material_payments.reduce((s, p) => s + Number(p.amount_paid), 0)
  const cost        = spool.price_usd_raw
  const balance     = totalPaid - cost
  const [payerName, setPayerName] = useState('')
  const [amount,    setAmount]    = useState('')
  const [paidAt,    setPaidAt]    = useState(new Date().toISOString().slice(0, 10))
  const [notes,     setNotes]     = useState('')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!payerName || !amount) return
    setSaving(true)
    setError('')
    try {
      await addMaterialPayment({
        material_id: spool.id,
        payer_name:  payerName,
        amount_paid: Number(amount),
        paid_at:     paidAt,
        notes:       notes || undefined,
      })
      setPayerName(''); setAmount(''); setNotes('')
      onRefresh()
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    try { await deleteMaterialPayment(id); onRefresh() } catch {}
  }

  return (
    <div className="border-t border-border mt-4 pt-4 space-y-4">
      {/* Balance summary */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-muted/40 px-3 py-2">
          <p className="text-xs text-muted-foreground">Item cost</p>
          <p className="text-sm font-mono font-semibold">{fmtCurrency(cost)}</p>
        </div>
        <div className="rounded-lg bg-muted/40 px-3 py-2">
          <p className="text-xs text-muted-foreground">Total paid</p>
          <p className="text-sm font-mono font-semibold">{fmtCurrency(totalPaid)}</p>
        </div>
        <div className={`rounded-lg px-3 py-2 ${balance >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
          <p className="text-xs text-muted-foreground">Balance</p>
          <p className={`text-sm font-mono font-semibold ${balance >= 0 ? 'text-green-500' : 'text-red-400'}`}>
            {balance >= 0 ? '+' : ''}{fmtCurrency(balance)}
          </p>
        </div>
      </div>

      {/* Existing payments */}
      {spool.material_payments.length > 0 && (
        <div className="space-y-1.5">
          {spool.material_payments.map(p => (
            <div key={p.id} className="flex items-center justify-between text-xs bg-muted/30 rounded-md px-3 py-2">
              <div>
                <span className="font-medium">{p.payer_name}</span>
                <span className="text-muted-foreground ml-2">{p.paid_at}</span>
                {p.notes && <span className="text-muted-foreground ml-2">· {p.notes}</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-orange-400">{fmtCurrency(Number(p.amount_paid))}</span>
                <button
                  onClick={() => remove(p.id)}
                  className="p-0.5 rounded text-muted-foreground hover:text-red-400 transition-colors"
                >
                  <X className="size-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add payment form */}
      <form onSubmit={submit} className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Record payment</p>
        <div className="grid grid-cols-2 gap-2">
          <input
            value={payerName}
            onChange={e => setPayerName(e.target.value)}
            placeholder="Partner name"
            className="col-span-2 text-xs bg-muted/40 border border-border rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="Amount"
            min={0}
            step={0.01}
            className="text-xs bg-muted/40 border border-border rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
          <input
            type="date"
            value={paidAt}
            onChange={e => setPaidAt(e.target.value)}
            className="text-xs bg-muted/40 border border-border rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
          <input
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="col-span-2 text-xs bg-muted/40 border border-border rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={saving || !payerName || !amount}
          className="w-full text-xs font-medium bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white rounded-md px-3 py-1.5 transition-colors"
        >
          {saving ? 'Saving…' : 'Add payment'}
        </button>
      </form>
    </div>
  )
}

function SpoolCard({ spool, onEdit, onDelete, onRefresh }: {
  spool: SpoolWithPayments
  onEdit: () => void
  onDelete: () => void
  onRefresh: () => void
}) {
  const { fmtCurrency } = useT()
  const pct      = remainingPct(spool)
  const [expanded, setExpanded] = useState(false)
  const totalPaid = spool.material_payments.reduce((s, p) => s + Number(p.amount_paid), 0)

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      {/* Header */}
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

      {/* Progress bar */}
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

      {/* Cost row */}
      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border">
        <div>
          <p className="text-xs text-muted-foreground">Cost/{spool.unit ?? 'g'}</p>
          <p className="text-sm font-mono font-semibold">{fmtCurrency(costPerGram(spool))}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Value left</p>
          <p className="text-sm font-mono font-semibold">{fmtCurrency(remainingValue(spool))}</p>
        </div>
      </div>

      {/* Payments toggle */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors pt-1 border-t border-border"
      >
        <span className="flex items-center gap-1.5">
          <Wallet className="size-3.5" />
          Payments
          {spool.material_payments.length > 0 && (
            <span className="bg-orange-500/10 text-orange-500 rounded-full px-1.5 py-0.5 text-[10px] font-medium">
              {spool.material_payments.length} · {fmtCurrency(totalPaid)}
            </span>
          )}
        </span>
        {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
      </button>

      {expanded && <PaymentPanel spool={spool} onRefresh={onRefresh} />}
    </div>
  )
}

export function FilamentList() {
  const { t, fmtCurrency } = useT()
  const m = t.materials
  const [spools, setSpools]     = useState<SpoolWithPayments[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState<FilamentSpool | null>(null)
  const [saving, setSaving]     = useState(false)

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
          { label: m.inventoryValue, value: fmtCurrency(totalValue) },
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
              onRefresh={load}
            />
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <FilamentForm
          key={editing?.id ?? 'new'}
          initial={editing}
          onSave={save}
          onClose={() => { setShowForm(false); setEditing(null) }}
          saving={saving}
        />
      )}
    </div>
  )
}
