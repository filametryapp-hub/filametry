'use client'

import { useState, useEffect } from 'react'
import { Plus, Layers, Pencil, Trash2, ChevronDown, ChevronUp, Wallet, X, SlidersHorizontal } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { FilamentForm } from './filament-form'
import { BatchEntryModal } from './batch-entry-modal'
import { getFilaments, upsertFilament, deleteFilament, addMaterialPayment, deleteMaterialPayment, getPartners, setFilamentStock, consumeFilamentG } from '@/lib/actions/filaments'
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
  code?: string
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
    code:          row.code ? String(row.code) : undefined,
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

function PaymentPanel({ spool, onRefresh, partners }: { spool: SpoolWithPayments; onRefresh: () => void; partners: { name: string }[] }) {
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
                <span className="font-mono text-blue-500">{fmtCurrency(Number(p.amount_paid))}</span>
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
        <p className="text-xs font-medium text-muted-foreground">Registrar pagamento</p>
        <div className="grid grid-cols-2 gap-2">
          {partners.length > 0 ? (
            <select
              value={payerName}
              onChange={e => setPayerName(e.target.value)}
              className="col-span-2 text-xs bg-muted/40 border border-border rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-600"
            >
              <option value="">Selecionar sócio…</option>
              {partners.map(p => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
          ) : (
            <input
              value={payerName}
              onChange={e => setPayerName(e.target.value)}
              placeholder="Nome do sócio"
              className="col-span-2 text-xs bg-muted/40 border border-border rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          )}
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="Amount"
            min={0}
            step={0.01}
            className="text-xs bg-muted/40 border border-border rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-600"
          />
          <input
            type="date"
            value={paidAt}
            onChange={e => setPaidAt(e.target.value)}
            className="text-xs bg-muted/40 border border-border rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-600"
          />
          <input
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="col-span-2 text-xs bg-muted/40 border border-border rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-600"
          />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={saving || !payerName || !amount}
          className="w-full text-xs font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-md px-3 py-1.5 transition-colors"
        >
          {saving ? 'Saving…' : 'Add payment'}
        </button>
      </form>
    </div>
  )
}

function StockAdjustPanel({ spool, onDone }: { spool: SpoolWithPayments; onDone: () => void }) {
  const unit = spool.unit ?? 'g'
  const [mode, setMode]   = useState<'set' | 'use'>('use')
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr]     = useState('')

  async function apply() {
    const n = parseFloat(value)
    if (isNaN(n) || n < 0) { setErr('Enter a valid number.'); return }
    setSaving(true); setErr('')
    try {
      if (mode === 'set') {
        if (n > spool.weightG) { setErr(`Max is ${spool.weightG}${unit}.`); setSaving(false); return }
        await setFilamentStock(spool.id!, n)
      } else {
        if (n > spool.remainingG) { setErr(`Only ${spool.remainingG}${unit} remaining.`); setSaving(false); return }
        await consumeFilamentG(spool.id!, n)
      }
      onDone()
    } catch { setErr('Error saving.') } finally { setSaving(false) }
  }

  return (
    <div className="pt-2 border-t border-border space-y-2">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Stock adjustment</p>
      {/* Mode toggle */}
      <div className="flex gap-1">
        {(['use', 'set'] as const).map(m => (
          <button key={m} onClick={() => { setMode(m); setValue(''); setErr('') }}
            className={`flex-1 text-[11px] py-1 rounded-md border transition-colors ${mode === m ? 'bg-blue-600 border-blue-600 text-white font-medium' : 'border-border text-muted-foreground hover:border-blue-600/40'}`}>
            {m === 'use' ? `Consumed (${unit})` : `Actual count (${unit})`}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">
        {mode === 'use'
          ? `How many ${unit} were used in test prints (will be subtracted from ${spool.remainingG}${unit})`
          : `Enter the actual weight on the spool right now`}
      </p>
      <div className="flex gap-2 items-center">
        <input
          type="number" min="0" step="0.1"
          value={value} onChange={e => setValue(e.target.value)}
          placeholder={mode === 'use' ? `e.g. 25` : `e.g. ${spool.remainingG}`}
          className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600/30"
        />
        <span className="text-xs text-muted-foreground shrink-0">{unit}</span>
        <button onClick={apply} disabled={saving || !value}
          className="text-xs px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium transition-colors shrink-0">
          {saving ? '…' : 'Save'}
        </button>
      </div>
      {err && <p className="text-[11px] text-red-400">{err}</p>}
    </div>
  )
}

function SpoolCard({ spool, onEdit, onDelete, onRefresh, partners }: {
  spool: SpoolWithPayments
  onEdit: () => void
  onDelete: () => void
  onRefresh: () => void
  partners: { name: string }[]
}) {
  const { fmtCurrency } = useT()
  const pct      = remainingPct(spool)
  const [expanded, setExpanded] = useState(false)
  const [adjusting, setAdjusting] = useState(false)
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
            <div className="flex items-center gap-1.5">
              {spool.code && (
                <span className="text-[10px] font-mono font-semibold text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded shrink-0">
                  {spool.code}
                </span>
              )}
              <p className="font-semibold text-sm leading-tight">{spool.brand}</p>
            </div>
            <p className="text-xs text-muted-foreground">{spool.color}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setAdjusting(v => !v); setExpanded(false) }}
            title="Adjust stock"
            className={`p-1.5 rounded-md transition-colors ${adjusting ? 'text-blue-600 bg-blue-600/10' : 'text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10'}`}
          >
            <SlidersHorizontal className="size-3.5" />
          </button>
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

      {/* Stock adjustment panel */}
      {adjusting && (
        <StockAdjustPanel
          spool={spool}
          onDone={() => { setAdjusting(false); onRefresh() }}
        />
      )}

      {/* Payments toggle */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors pt-1 border-t border-border"
      >
        <span className="flex items-center gap-1.5">
          <Wallet className="size-3.5" />
          Payments
          {spool.material_payments.length > 0 && (
            <span className="bg-blue-600/10 text-blue-600 rounded-full px-1.5 py-0.5 text-[10px] font-medium">
              {spool.material_payments.length} · {fmtCurrency(totalPaid)}
            </span>
          )}
        </span>
        {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
      </button>

      {expanded && <PaymentPanel spool={spool} onRefresh={onRefresh} partners={partners ?? []} />}
    </div>
  )
}

export function FilamentList() {
  const { t, fmtCurrency } = useT()
  const m = t.materials
  const [spools, setSpools]         = useState<SpoolWithPayments[]>([])
  const [partners, setPartners]     = useState<{ name: string }[]>([])
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [showBatch, setShowBatch]   = useState(false)
  const [editing, setEditing]       = useState<FilamentSpool | null>(null)
  const [saving, setSaving]         = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [rows, pts] = await Promise.all([getFilaments(), getPartners()])
      setSpools((rows ?? []).map(r => fromRow(r as Record<string, unknown>)))
      setPartners(pts)
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
        paid_by:      data.paidBy ?? 'company',
      })

      // Record partner payment if specified at creation time
      if (!data.id && data.paidBy === 'partner' && data.paidByName && (data.paidByAmount ?? 0) > 0) {
        try {
          // Re-load to get the new ID, then record payment
          const rows = await getFilaments()
          const fresh = (rows ?? []).map(r => fromRow(r as Record<string, unknown>))
          setSpools(fresh)
          const newSpool = fresh[0] // most recent = just inserted
          if (newSpool) {
            await addMaterialPayment({
              material_id: newSpool.id,
              payer_name:  data.paidByName,
              amount_paid: data.paidByAmount ?? data.priceUSD,
              paid_at:     data.purchasedAt ?? new Date().toISOString().slice(0, 10),
            })
          }
        } catch { /* payment recording failure must not break the flow */ }
      }

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
        <div className="size-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
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
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">{m.itemsInStock(spools.length)}</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBatch(true)}
            className="flex items-center gap-2 border border-blue-600 text-blue-600 hover:bg-blue-600/10 text-sm font-medium px-4 py-2 rounded-md transition-colors"
          >
            <Plus className="size-4" /> Entrada em Lote
          </button>
          <button
            onClick={() => { setEditing(null); setShowForm(true) }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
          >
            <Plus className="size-4" /> {m.addItem}
          </button>
        </div>
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
              partners={partners}
            />
          ))}
        </div>
      )}

      {/* Single-item form modal */}
      {showForm && (
        <FilamentForm
          key={editing?.id ?? 'new'}
          initial={editing}
          onSave={save}
          onClose={() => { setShowForm(false); setEditing(null) }}
          saving={saving}
          partners={partners}
        />
      )}

      {/* Batch entry modal */}
      {showBatch && (
        <BatchEntryModal
          onSaved={load}
          onClose={() => setShowBatch(false)}
        />
      )}
    </div>
  )
}
