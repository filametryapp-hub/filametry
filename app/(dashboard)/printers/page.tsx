'use client'

import { useState, useEffect } from 'react'
import { Printer, Plus, Trash2, DollarSign, Clock, Zap, TrendingDown, ChevronDown, ChevronUp, AlertCircle, CheckCircle2 } from 'lucide-react'
import {
  getUserPrinters, addPrinter, deletePrinter,
  addEquipmentPayment, deleteEquipmentPayment,
} from '@/lib/actions/printers'
import { getPartners } from '@/lib/actions/company'
import { getProfile } from '@/lib/actions/billing'
import { TRIAL_PRINTER_LIMIT } from '@/lib/stripe/plans'

type Partner = { id: string; name: string; percentage: number }
type Payment = { id: string; payer_name: string; amount_paid: number; paid_at: string; notes?: string | null }
type PrinterRow = {
  id: string; name: string; brand: string; model: string; watts: number
  purchase_value: number; purchase_date?: string | null; lifespan_hours: number
  equipment_payments: Payment[]
}

const INPUT = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors placeholder:text-muted-foreground'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
}

function costPerHour(p: PrinterRow) {
  if (!p.purchase_value || !p.lifespan_hours) return 0
  return p.purchase_value / p.lifespan_hours
}

// ── Debt summary per printer ───────────────────────────────────
function DebtSummary({ printer, partners }: { printer: PrinterRow; partners: Partner[] }) {
  if (!partners.length || !printer.purchase_value) return null

  const payments = printer.equipment_payments ?? []
  const debts = partners.map(partner => {
    const expected = printer.purchase_value * (partner.percentage / 100)
    const paid     = payments.filter(p => p.payer_name === partner.name).reduce((s, p) => s + Number(p.amount_paid), 0)
    return { name: partner.name, expected, paid, balance: paid - expected }
  })

  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3 space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Partnership share</p>
      {debts.map(d => (
        <div key={d.name} className="flex items-center justify-between text-xs">
          <span className="font-medium">{d.name}</span>
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground">expected {fmt(d.expected)}</span>
            <span className="text-muted-foreground">paid {fmt(d.paid)}</span>
            <span className={`font-semibold flex items-center gap-1 ${d.balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {d.balance >= 0
                ? <><CheckCircle2 className="size-3" /> owed {fmt(d.balance)}</>
                : <><AlertCircle className="size-3" /> owes {fmt(Math.abs(d.balance))}</>}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Single printer card ────────────────────────────────────────
function PrinterCard({ printer, partners, onDelete, onPaymentAdded, onPaymentDeleted }: {
  printer: PrinterRow
  partners: Partner[]
  onDelete: () => void
  onPaymentAdded: (payment: { payer_name: string; amount_paid: number; paid_at: string }) => void
  onPaymentDeleted: (paymentId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [addingPay, setAddingPay] = useState(false)
  const [payForm, setPayForm] = useState({ payer_name: partners[0]?.name ?? '', amount_paid: '', paid_at: new Date().toISOString().slice(0, 10) })
  const [savingPay, setSavingPay] = useState(false)
  const [payError, setPayError] = useState('')

  const cph = costPerHour(printer)
  const totalPaid = (printer.equipment_payments ?? []).reduce((s, p) => s + Number(p.amount_paid), 0)

  async function handleAddPayment() {
    if (!payForm.payer_name || !payForm.amount_paid) { setPayError('Name and amount required.'); return }
    setSavingPay(true)
    setPayError('')
    try {
      await addEquipmentPayment({
        printer_id:  printer.id,
        payer_name:  payForm.payer_name,
        amount_paid: parseFloat(payForm.amount_paid),
        paid_at:     payForm.paid_at,
      })
      onPaymentAdded({ payer_name: payForm.payer_name, amount_paid: parseFloat(payForm.amount_paid), paid_at: payForm.paid_at })
      setPayForm(f => ({ ...f, amount_paid: '' }))
      setAddingPay(false)
    } catch (e) {
      setPayError(e instanceof Error ? e.message : 'Failed to add payment.')
    } finally {
      setSavingPay(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Main row */}
      <div className="flex items-center gap-4 px-5 py-4">
        <div className="p-2.5 rounded-lg bg-orange-500/10 shrink-0">
          <Printer className="size-4 text-orange-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{printer.name}</p>
          <p className="text-xs text-muted-foreground">{printer.brand} {printer.model} · {printer.watts}W</p>
        </div>
        {/* Quick stats */}
        <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground">
          {printer.purchase_value > 0 && (
            <span className="flex items-center gap-1">
              <DollarSign className="size-3" /> {fmt(printer.purchase_value)}
            </span>
          )}
          {cph > 0 && (
            <span className="flex items-center gap-1 text-orange-500 font-mono font-medium">
              <TrendingDown className="size-3" /> {fmt(cph)}/h
            </span>
          )}
          {printer.lifespan_hours > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="size-3" /> {printer.lifespan_hours.toLocaleString()}h
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setExpanded(e => !e)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-border pt-4 space-y-4">
          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground mb-1">Purchase value</p>
              <p className="text-sm font-semibold">{printer.purchase_value > 0 ? fmt(printer.purchase_value) : '—'}</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground mb-1">Lifespan</p>
              <p className="text-sm font-semibold">{printer.lifespan_hours.toLocaleString()}h</p>
            </div>
            <div className="rounded-lg bg-orange-500/10 p-3">
              <p className="text-xs text-orange-400/80 mb-1">Cost per hour</p>
              <p className="text-sm font-semibold text-orange-500">{cph > 0 ? fmt(cph) : '—'}</p>
            </div>
          </div>

          {/* Partner debt summary */}
          {partners.length > 0 && printer.purchase_value > 0 && (
            <DebtSummary printer={printer} partners={partners} />
          )}

          {/* Payments list */}
          {(printer.equipment_payments ?? []).length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Payments</p>
                <span className="text-xs font-mono text-muted-foreground">Total paid: {fmt(totalPaid)}</span>
              </div>
              <div className="rounded-lg border border-border divide-y divide-border">
                {(printer.equipment_payments ?? []).map(pay => (
                  <div key={pay.id} className="flex items-center justify-between px-3 py-2 text-xs">
                    <div>
                      <span className="font-medium">{pay.payer_name}</span>
                      <span className="text-muted-foreground ml-2">{pay.paid_at}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-semibold">{fmt(Number(pay.amount_paid))}</span>
                      <button
                        onClick={() => { deleteEquipmentPayment(pay.id); onPaymentDeleted(pay.id) }}
                        className="text-muted-foreground hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add payment */}
          {!addingPay ? (
            <button
              onClick={() => setAddingPay(true)}
              className="flex items-center gap-1.5 text-xs text-orange-500 hover:text-orange-600 transition-colors"
            >
              <Plus className="size-3.5" /> Record payment
            </button>
          ) : (
            <div className="rounded-lg border border-border p-3 space-y-3">
              <p className="text-xs font-medium">Record payment</p>
              <div className="grid grid-cols-3 gap-2">
                {partners.length > 0 ? (
                  <select
                    className={INPUT + ' text-xs py-1.5'}
                    value={payForm.payer_name}
                    onChange={e => setPayForm(f => ({ ...f, payer_name: e.target.value }))}
                  >
                    {partners.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                  </select>
                ) : (
                  <input className={INPUT + ' text-xs py-1.5'} placeholder="Payer name" value={payForm.payer_name}
                    onChange={e => setPayForm(f => ({ ...f, payer_name: e.target.value }))} />
                )}
                <input className={INPUT + ' text-xs py-1.5'} type="number" placeholder="Amount $" value={payForm.amount_paid}
                  onChange={e => setPayForm(f => ({ ...f, amount_paid: e.target.value }))} min="0" step="0.01" />
                <input className={INPUT + ' text-xs py-1.5'} type="date" value={payForm.paid_at}
                  onChange={e => setPayForm(f => ({ ...f, paid_at: e.target.value }))} />
              </div>
              {payError && <p className="text-xs text-red-400">{payError}</p>}
              <div className="flex gap-2">
                <button onClick={() => setAddingPay(false)} className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted transition-colors">Cancel</button>
                <button onClick={handleAddPayment} disabled={savingPay}
                  className="text-xs px-3 py-1.5 rounded-md bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50 transition-colors">
                  {savingPay ? 'Saving…' : 'Add payment'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Add printer form ───────────────────────────────────────────
function AddPrinterForm({ onAdd, atLimit }: { onAdd: (p: PrinterRow) => void; atLimit: boolean }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '', brand: '', model: '', watts: 120,
    purchase_value: '', purchase_date: '', lifespan_hours: 5000,
  })

  if (atLimit) {
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-center space-y-2">
        <Printer className="size-8 text-muted-foreground mx-auto" />
        <p className="text-sm font-medium">Printer limit reached</p>
        <p className="text-xs text-muted-foreground">Upgrade your plan to register more printers.</p>
        <a href="/billing" className="inline-flex items-center gap-1.5 text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-md font-medium transition-colors mt-1">
          <Zap className="size-3" /> Upgrade plan
        </a>
      </div>
    )
  }

  async function handleAdd() {
    if (!form.name || !form.brand || !form.model) { setError('Name, brand and model are required.'); return }
    setSaving(true)
    setError('')
    try {
      const printer = await addPrinter({
        name:           form.name,
        brand:          form.brand,
        model:          form.model,
        watts:          form.watts,
        purchase_value: form.purchase_value ? parseFloat(form.purchase_value) : 0,
        purchase_date:  form.purchase_date || undefined,
        lifespan_hours: form.lifespan_hours,
      })
      onAdd({ ...printer, equipment_payments: [] } as PrinterRow)
      setForm({ name: '', brand: '', model: '', watts: 120, purchase_value: '', purchase_date: '', lifespan_hours: 5000 })
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add printer.')
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-border py-5 text-sm text-muted-foreground hover:border-orange-500/50 hover:text-orange-500 transition-colors">
        <Plus className="size-4" /> Add printer
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <h3 className="font-semibold text-sm">Add printer / equipment</h3>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground">Nickname *</label>
          <input className={INPUT + ' mt-1'} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Bambu A1 #1" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Brand *</label>
          <input className={INPUT + ' mt-1'} value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} placeholder="Bambu Lab" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Model *</label>
          <input className={INPUT + ' mt-1'} value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} placeholder="A1" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Power (W)</label>
          <input className={INPUT + ' mt-1'} type="number" min={1} value={form.watts} onChange={e => setForm(f => ({ ...f, watts: +e.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Purchase date</label>
          <input className={INPUT + ' mt-1'} type="date" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} />
        </div>
      </div>

      <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-3 space-y-3">
        <p className="text-xs font-medium text-orange-400">Equipment value (for amortization)</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Purchase value ($)</label>
            <input className={INPUT + ' mt-1'} type="number" min={0} step={0.01} value={form.purchase_value}
              onChange={e => setForm(f => ({ ...f, purchase_value: e.target.value }))} placeholder="e.g. 599.00" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Expected lifespan (hours)</label>
            <input className={INPUT + ' mt-1'} type="number" min={100} step={100} value={form.lifespan_hours}
              onChange={e => setForm(f => ({ ...f, lifespan_hours: +e.target.value }))} />
          </div>
        </div>
        {form.purchase_value && form.lifespan_hours ? (
          <p className="text-xs text-orange-400 font-mono">
            → Cost per hour: {fmt(parseFloat(form.purchase_value || '0') / form.lifespan_hours)}
          </p>
        ) : null}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-3">
        <button onClick={() => setOpen(false)} className="flex-1 rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted transition-colors">Cancel</button>
        <button onClick={handleAdd} disabled={saving}
          className="flex-1 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 transition-colors">
          {saving ? 'Adding…' : 'Add printer'}
        </button>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────
export default function PrintersPage() {
  const [printers, setPrinters] = useState<PrinterRow[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading]   = useState(true)
  const [limit, setLimit]       = useState(TRIAL_PRINTER_LIMIT)

  useEffect(() => {
    async function load() {
      try {
        const [rows, plist, profile] = await Promise.all([
          getUserPrinters(),
          getPartners(),
          getProfile(),
        ])
        setPrinters((rows ?? []) as PrinterRow[])
        setPartners((plist ?? []) as Partner[])
        setLimit(profile?.printer_limit ?? TRIAL_PRINTER_LIMIT)
      } catch {
        // silently fail — page will show empty state
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const atLimit     = printers.length >= limit
  const displayLimit = limit === 9999 ? '∞' : String(limit)
  const totalValue  = printers.reduce((s, p) => s + Number(p.purchase_value ?? 0), 0)
  const totalCph    = printers.reduce((s, p) => s + costPerHour(p), 0)

  function handleDelete(id: string) {
    deletePrinter(id)
    setPrinters(prev => prev.filter(p => p.id !== id))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="size-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Equipment</h1>
          <p className="text-muted-foreground mt-1">Manage printers and track equipment investment.</p>
        </div>
        <span className="text-sm text-muted-foreground bg-muted px-3 py-1.5 rounded-full font-medium shrink-0">
          {printers.length} / {displayLimit}
        </span>
      </div>

      {/* Fleet summary */}
      {printers.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-card px-5 py-4">
            <p className="text-xs text-muted-foreground">Fleet value</p>
            <p className="text-xl font-bold mt-0.5">{fmt(totalValue)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card px-5 py-4">
            <p className="text-xs text-muted-foreground">Printers</p>
            <p className="text-xl font-bold mt-0.5">{printers.length}</p>
          </div>
          <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 px-5 py-4">
            <p className="text-xs text-orange-400/80">Total cost/hour</p>
            <p className="text-xl font-bold mt-0.5 text-orange-500">{fmt(totalCph)}</p>
          </div>
        </div>
      )}

      {/* Printer cards */}
      <div className="space-y-3">
        {printers.map(printer => (
          <PrinterCard
            key={printer.id}
            printer={printer}
            partners={partners}
            onDelete={() => handleDelete(printer.id)}
            onPaymentAdded={(pay) => {
              setPrinters(prev => prev.map(p =>
                p.id === printer.id
                  ? { ...p, equipment_payments: [...(p.equipment_payments ?? []), { id: crypto.randomUUID(), ...pay, notes: null }] }
                  : p
              ))
            }}
            onPaymentDeleted={(payId) => {
              setPrinters(prev => prev.map(p =>
                p.id === printer.id
                  ? { ...p, equipment_payments: (p.equipment_payments ?? []).filter(ep => ep.id !== payId) }
                  : p
              ))
            }}
          />
        ))}

        <AddPrinterForm atLimit={atLimit} onAdd={p => setPrinters(prev => [...prev, p])} />
      </div>
    </div>
  )
}
