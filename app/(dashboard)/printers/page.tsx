'use client'

import { useState, useEffect } from 'react'
import { Printer, Plus, Trash2, DollarSign, Clock, Zap, TrendingDown, ChevronDown, ChevronUp, AlertCircle, CheckCircle2, BarChart3, Receipt, Pencil, Check, X } from 'lucide-react'
import {
  getUserPrinters, addPrinter, deletePrinter, updatePrinter,
  addEquipmentPayment, deleteEquipmentPayment,
  getAmortizationData,
} from '@/lib/actions/printers'
import { recalculateProductCosts } from '@/lib/actions/products'
import { createExpense } from '@/lib/actions/expenses'
import { getPartners } from '@/lib/actions/company'
import { getProfile } from '@/lib/actions/billing'
import { TRIAL_PRINTER_LIMIT } from '@/lib/stripe/plans'
import { useT } from '@/lib/i18n'
import { CurrencyInput } from '@/components/ui/currency-input'

type Partner = { id: string; name: string; percentage: number }
type Payment = { id: string; payer_name: string; amount_paid: number; paid_at: string; notes?: string | null }
type LongPrintTierRow = { min_hours: number; min_margin_pct: number }
type PrinterRow = {
  id: string; name: string; brand: string; model: string; watts: number
  purchase_value: number; purchase_date?: string | null; lifespan_hours: number
  purchase_expense_recorded?: boolean
  equipment_payments: Payment[]
  long_print_tiers?: LongPrintTierRow[] | null
  daily_rate?: number
  working_hours_per_day?: number
}
type AmortPrinter = { id: string; amortizedValue: number; remaining: number; pct: number }

const INPUT = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors placeholder:text-muted-foreground'

function costPerHour(p: PrinterRow) {
  if (!p.purchase_value || !p.lifespan_hours) return 0
  return p.purchase_value / p.lifespan_hours
}

// ── Debt summary per printer ───────────────────────────────────
function DebtSummary({ printer, partners }: { printer: PrinterRow; partners: Partner[] }) {
  const { t, fmtCurrency } = useT()
  const eq = t.equipment
  if (!partners.length || !printer.purchase_value) return null

  const payments = printer.equipment_payments ?? []
  const debts = partners.map(partner => {
    const expected = printer.purchase_value * (partner.percentage / 100)
    const paid     = payments.filter(p => p.payer_name === partner.name).reduce((s, p) => s + Number(p.amount_paid), 0)
    return { name: partner.name, expected, paid, balance: paid - expected }
  })

  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3 space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{eq.partnershipShare}</p>
      {debts.map(d => (
        <div key={d.name} className="flex items-center justify-between text-xs">
          <span className="font-medium">{d.name}</span>
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground">{eq.expected} {fmtCurrency(d.expected)}</span>
            <span className="text-muted-foreground">{eq.paid} {fmtCurrency(d.paid)}</span>
            <span className={`font-semibold flex items-center gap-1 ${d.balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {d.balance >= 0
                ? <><CheckCircle2 className="size-3" /> {eq.isOwed} {fmtCurrency(d.balance)}</>
                : <><AlertCircle className="size-3" /> {eq.owes} {fmtCurrency(Math.abs(d.balance))}</>}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Single printer card ────────────────────────────────────────
function PrinterCard({ printer, partners, amortPrinter, onDelete, onPaymentAdded, onPaymentDeleted }: {
  printer: PrinterRow
  partners: Partner[]
  amortPrinter?: AmortPrinter
  onDelete: () => void
  onPaymentAdded: (payment: { payer_name: string; amount_paid: number; paid_at: string }) => void
  onPaymentDeleted: (paymentId: string) => void
}) {
  const { t, fmtCurrency } = useT()
  const eq = t.equipment
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    watts:                printer.watts,
    purchase_value:       printer.purchase_value,
    lifespan_hours:       printer.lifespan_hours,
    daily_rate:           printer.daily_rate ?? 0,
    working_hours_per_day: printer.working_hours_per_day ?? 20,
  })
  const [savingEdit, setSavingEdit] = useState(false)

  async function handleSaveEdit() {
    setSavingEdit(true)
    try {
      await updatePrinter(printer.id, editForm)
      printer.watts                 = editForm.watts
      printer.purchase_value        = editForm.purchase_value
      printer.lifespan_hours        = editForm.lifespan_hours
      printer.daily_rate            = editForm.daily_rate
      printer.working_hours_per_day = editForm.working_hours_per_day
      setEditing(false)
    } catch { /* silent */ } finally {
      setSavingEdit(false)
    }
  }

  const [addingPay, setAddingPay] = useState(false)
  const [payForm, setPayForm] = useState({ payer_name: partners[0]?.name ?? '', amount_paid: 0, paid_at: new Date().toISOString().slice(0, 10) })
  const [savingPay, setSavingPay] = useState(false)
  const [payError, setPayError] = useState('')
  const [expenseRecorded, setExpenseRecorded] = useState(printer.purchase_expense_recorded ?? false)
  const [recordingExpense, setRecordingExpense] = useState(false)
  const [expensePaidBy, setExpensePaidBy] = useState<'company' | 'partner'>('company')

  async function handleRecordPurchaseExpense() {
    if (!printer.purchase_value) return
    setRecordingExpense(true)
    try {
      await createExpense({
        category:    'equipment',
        description: `${printer.brand} ${printer.model} — ${printer.name}`,
        amount:      printer.purchase_value,
        paid_at:     printer.purchase_date ?? new Date().toISOString().slice(0, 10),
        paid_by:     expensePaidBy,
      })
      await updatePrinter(printer.id, { purchase_expense_recorded: true })
      setExpenseRecorded(true)
    } catch { /* silent */ } finally {
      setRecordingExpense(false)
    }
  }

  const cph = costPerHour(printer)
  const totalPaid = (printer.equipment_payments ?? []).reduce((s, p) => s + Number(p.amount_paid), 0)

  async function handleAddPayment() {
    if (!payForm.payer_name || !payForm.amount_paid) { setPayError(`${eq.payerName} and ${eq.amount} required.`); return }
    setSavingPay(true)
    setPayError('')
    try {
      await addEquipmentPayment({
        printer_id:  printer.id,
        payer_name:  payForm.payer_name,
        amount_paid: payForm.amount_paid,
        paid_at:     payForm.paid_at,
      })
      onPaymentAdded({ payer_name: payForm.payer_name, amount_paid: payForm.amount_paid, paid_at: payForm.paid_at })
      setPayForm(f => ({ ...f, amount_paid: 0 }))
      setAddingPay(false)
    } catch (e) {
      setPayError(e instanceof Error ? e.message : t.common.error)
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
          {(printer.daily_rate ?? 0) > 0 ? (
            <>
              <span className="flex items-center gap-1 text-orange-500 font-mono font-medium">
                <DollarSign className="size-3" /> {fmtCurrency(printer.daily_rate!)}/dia
              </span>
              <span className="flex items-center gap-1">
                <Clock className="size-3" /> {printer.working_hours_per_day ?? 20}h/dia
              </span>
              <span className="flex items-center gap-1 font-mono">
                <TrendingDown className="size-3" />
                {fmtCurrency((printer.daily_rate!) / (printer.working_hours_per_day ?? 20))}/h
              </span>
            </>
          ) : (
            <>
              {printer.purchase_value > 0 && (
                <span className="flex items-center gap-1">
                  <DollarSign className="size-3" /> {fmtCurrency(printer.purchase_value)}
                </span>
              )}
              {cph > 0 && (
                <span className="flex items-center gap-1 text-orange-500 font-mono font-medium">
                  <TrendingDown className="size-3" /> {fmtCurrency(cph)}/h
                </span>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setEditing(e => !e); setExpanded(true) }}
            className="p-1.5 rounded-md text-muted-foreground hover:text-orange-400 hover:bg-orange-400/10 transition-colors"
            title="Edit printer"
          >
            <Pencil className="size-4" />
          </button>
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
          {/* Stats grid / Edit form */}
          {editing ? (
            <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-4 space-y-3">
              <p className="text-xs font-semibold text-orange-400 uppercase tracking-wide">Editar impressora</p>

              {/* Daily rate — primary pricing input */}
              <div className="rounded-md bg-orange-500/10 border border-orange-500/20 p-3 space-y-2">
                <p className="text-[10px] font-semibold text-orange-400 uppercase tracking-wide">
                  Diária de máquina
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Meta diária ($)</label>
                    <CurrencyInput value={editForm.daily_rate}
                      onChange={v => setEditForm(f => ({ ...f, daily_rate: v }))}
                      className={INPUT + ' mt-1 h-9'} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Horas ativas / dia</label>
                    <input type="number" min={1} max={24} step={0.5} className={INPUT + ' mt-1 h-9'}
                      value={editForm.working_hours_per_day}
                      onChange={e => setEditForm(f => ({ ...f, working_hours_per_day: +e.target.value }))} />
                  </div>
                </div>
                {editForm.daily_rate > 0 && editForm.working_hours_per_day > 0 && (
                  <p className="text-xs font-mono text-orange-400">
                    → taxa efetiva: {fmtCurrency(editForm.daily_rate / editForm.working_hours_per_day)}/h
                    &nbsp;·&nbsp;
                    produto de 8h = {fmtCurrency(8 * editForm.daily_rate / editForm.working_hours_per_day)} de máquina
                  </p>
                )}
              </div>

              {/* Hardware specs — used for amortization tracking */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">{eq.power} (W)</label>
                  <input type="number" min={1} className={INPUT + ' mt-1 h-9'}
                    value={editForm.watts}
                    onChange={e => setEditForm(f => ({ ...f, watts: +e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{eq.purchaseValue} ($)</label>
                  <CurrencyInput value={editForm.purchase_value}
                    onChange={v => setEditForm(f => ({ ...f, purchase_value: v }))}
                    className={INPUT + ' mt-1 h-9'} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{eq.expectedLifespan}</label>
                  <input type="number" min={100} step={100} className={INPUT + ' mt-1 h-9'}
                    value={editForm.lifespan_hours}
                    onChange={e => setEditForm(f => ({ ...f, lifespan_hours: +e.target.value }))} />
                </div>
              </div>
              {editForm.purchase_value > 0 && editForm.lifespan_hours > 0 && (
                <p className="text-xs text-muted-foreground font-mono">
                  amortização: {fmtCurrency(editForm.purchase_value / editForm.lifespan_hours)}/h
                  <span className="text-muted-foreground/50 ml-1">(só para controle de retorno)</span>
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={() => setEditing(false)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted transition-colors">
                  <X className="size-3.5" /> Cancelar
                </button>
                <button onClick={handleSaveEdit} disabled={savingEdit}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-medium transition-colors">
                  <Check className="size-3.5" /> {savingEdit ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground mb-1">{eq.purchaseValue}</p>
                <p className="text-sm font-semibold">{printer.purchase_value > 0 ? fmtCurrency(printer.purchase_value) : '—'}</p>
              </div>
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground mb-1">{eq.lifespan}</p>
                <p className="text-sm font-semibold">{printer.lifespan_hours.toLocaleString()}h</p>
              </div>
              <div className="rounded-lg bg-orange-500/10 p-3">
                <p className="text-xs text-orange-400/80 mb-1">{eq.costPerHour}</p>
                <p className="text-sm font-semibold text-orange-500">{cph > 0 ? fmtCurrency(cph) : '—'}</p>
              </div>
            </div>
          )}

          {/* Register purchase as expense (retroactive) */}
          {printer.purchase_value > 0 && !expenseRecorded && (
            <div className="rounded-lg border border-dashed border-orange-500/30 bg-orange-500/5 px-4 py-3 space-y-2.5">
              <div>
                <p className="text-xs font-medium text-orange-400">Compra não registrada nas Despesas</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {fmtCurrency(printer.purchase_value)} não aparece no Fluxo de Caixa nem na Carteira de despesas. Registre uma vez para corrigir.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5 flex-1">
                  {(['company', 'partner'] as const).map(opt => (
                    <button key={opt} type="button" onClick={() => setExpensePaidBy(opt)}
                      className={`flex-1 py-1 rounded border text-xs font-medium transition-colors ${
                        expensePaidBy === opt
                          ? 'border-orange-500 bg-orange-500/20 text-orange-400'
                          : 'border-border text-muted-foreground hover:border-orange-500/40'
                      }`}>
                      {opt === 'company' ? '🏢 Empresa' : '🤝 Sócio'}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleRecordPurchaseExpense}
                  disabled={recordingExpense}
                  className="flex items-center gap-1.5 text-xs font-medium bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-md transition-colors shrink-0"
                >
                  <Receipt className="size-3.5" />
                  {recordingExpense ? 'Registrando…' : 'Registrar agora'}
                </button>
              </div>
            </div>
          )}
          {expenseRecorded && (
            <div className="rounded-lg border border-green-500/20 bg-green-500/5 px-4 py-2.5 flex items-center gap-2 text-xs text-green-400">
              <CheckCircle2 className="size-3.5 shrink-0" />
              Compra de {fmtCurrency(printer.purchase_value)} registrada nas despesas com sucesso.
            </div>
          )}

          {/* Amortization progress */}
          {amortPrinter && printer.purchase_value > 0 && printer.lifespan_hours > 0 && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <BarChart3 className="size-3 text-orange-500" />
                  {eq.amortProgress}
                </p>
                <span className="text-xs font-mono font-semibold text-orange-500">
                  {Math.min(amortPrinter.pct, 100).toFixed(1)}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-orange-500 rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(amortPrinter.pct, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{eq.amortized}: <span className="font-medium text-foreground">{fmtCurrency(amortPrinter.amortizedValue)}</span></span>
                <span>{eq.remaining}: <span className="font-medium text-foreground">{fmtCurrency(amortPrinter.remaining)}</span></span>
              </div>
              <p className="text-[11px] text-muted-foreground/60">{eq.amortNote}</p>
            </div>
          )}

          {/* Partner debt summary */}
          {partners.length > 0 && printer.purchase_value > 0 && (
            <DebtSummary printer={printer} partners={partners} />
          )}

          {/* Payments list */}
          {(printer.equipment_payments ?? []).length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{eq.payments}</p>
                <span className="text-xs font-mono text-muted-foreground">{eq.totalPaid}: {fmtCurrency(totalPaid)}</span>
              </div>
              <div className="rounded-lg border border-border divide-y divide-border">
                {(printer.equipment_payments ?? []).map(pay => (
                  <div key={pay.id} className="flex items-center justify-between px-3 py-2 text-xs">
                    <div>
                      <span className="font-medium">{pay.payer_name}</span>
                      <span className="text-muted-foreground ml-2">{pay.paid_at}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-semibold">{fmtCurrency(Number(pay.amount_paid))}</span>
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
              <Plus className="size-3.5" /> {eq.recordPayment}
            </button>
          ) : (
            <div className="rounded-lg border border-border p-3 space-y-3">
              <p className="text-xs font-medium">{eq.recordPayment}</p>
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
                  <input className={INPUT + ' text-xs py-1.5'} placeholder={eq.payerName} value={payForm.payer_name}
                    onChange={e => setPayForm(f => ({ ...f, payer_name: e.target.value }))} />
                )}
                <CurrencyInput
                  value={payForm.amount_paid}
                  onChange={v => setPayForm(f => ({ ...f, amount_paid: v }))}
                  className={INPUT + ' text-xs py-1.5'}
                />
                <input className={INPUT + ' text-xs py-1.5'} type="date" value={payForm.paid_at}
                  onChange={e => setPayForm(f => ({ ...f, paid_at: e.target.value }))} />
              </div>
              {payError && <p className="text-xs text-red-400">{payError}</p>}
              <div className="flex gap-2">
                <button onClick={() => setAddingPay(false)} className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted transition-colors">{t.common.cancel}</button>
                <button onClick={handleAddPayment} disabled={savingPay}
                  className="text-xs px-3 py-1.5 rounded-md bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50 transition-colors">
                  {savingPay ? t.common.saving : eq.addPayment}
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
  const { t, fmtCurrency, currencySymbol } = useT()
  const eq = t.equipment
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '', brand: '', model: '', watts: 120,
    purchase_value: 0, purchase_date: '', lifespan_hours: 5000,
  })
  // Payback helper: prazo em meses + horas diárias → calcula lifespan_hours
  const [paybackMonths, setPaybackMonths] = useState(24)
  const [hoursPerDay,   setHoursPerDay]   = useState(6)
  const [usePrazo,      setUsePrazo]      = useState(false)

  function applyPrazo(months: number, hpd: number) {
    const h = Math.round(months * 30 * hpd)
    setForm(f => ({ ...f, lifespan_hours: h }))
  }

  if (atLimit) {
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-center space-y-2">
        <Printer className="size-8 text-muted-foreground mx-auto" />
        <p className="text-sm font-medium">{eq.atLimit}</p>
        <p className="text-xs text-muted-foreground">{eq.upgradeToAdd}</p>
        <a href="/billing" className="inline-flex items-center gap-1.5 text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-md font-medium transition-colors mt-1">
          <Zap className="size-3" /> {eq.upgradePlan}
        </a>
      </div>
    )
  }

  async function handleAdd() {
    if (!form.name || !form.brand || !form.model) { setError(`${eq.nickname}, ${eq.brand} and ${eq.model} are required.`); return }
    setSaving(true)
    setError('')
    try {
      const printer = await addPrinter({
        name:           form.name,
        brand:          form.brand,
        model:          form.model,
        watts:          form.watts,
        purchase_value: form.purchase_value,
        purchase_date:  form.purchase_date || undefined,
        lifespan_hours: form.lifespan_hours,
      })
      onAdd({ ...printer, equipment_payments: [] } as PrinterRow)
      setForm({ name: '', brand: '', model: '', watts: 120, purchase_value: 0, purchase_date: '', lifespan_hours: 5000 })
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : t.common.error)
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-border py-5 text-sm text-muted-foreground hover:border-orange-500/50 hover:text-orange-500 transition-colors">
        <Plus className="size-4" /> {eq.addPrinter}
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <h3 className="font-semibold text-sm">{eq.addPrinter}</h3>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground">{eq.nickname} *</label>
          <input className={INPUT + ' mt-1'} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Bambu A1 #1" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">{eq.brand} *</label>
          <input className={INPUT + ' mt-1'} value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} placeholder="Bambu Lab" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">{eq.model} *</label>
          <input className={INPUT + ' mt-1'} value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} placeholder="A1" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">{eq.power}</label>
          <input className={INPUT + ' mt-1'} type="number" min={1} value={form.watts} onChange={e => setForm(f => ({ ...f, watts: +e.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">{eq.purchaseDate}</label>
          <input className={INPUT + ' mt-1'} type="date" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} />
        </div>
      </div>

      <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-3 space-y-3">
        <p className="text-xs font-medium text-orange-400">{eq.equipValue}</p>

        {/* Purchase value */}
        <div>
          <label className="text-xs text-muted-foreground">{eq.purchaseValue} ({currencySymbol})</label>
          <CurrencyInput
            value={form.purchase_value}
            onChange={v => setForm(f => ({ ...f, purchase_value: v }))}
            className={INPUT + ' mt-1'}
          />
        </div>

        {/* Amortization mode toggle */}
        <div className="flex gap-2">
          <button type="button"
            onClick={() => setUsePrazo(false)}
            className={`flex-1 text-xs py-1.5 rounded-md border transition-colors ${!usePrazo ? 'bg-orange-500 border-orange-500 text-white' : 'border-border text-muted-foreground hover:border-orange-500/50'}`}>
            Por horas totais
          </button>
          <button type="button"
            onClick={() => { setUsePrazo(true); applyPrazo(paybackMonths, hoursPerDay) }}
            className={`flex-1 text-xs py-1.5 rounded-md border transition-colors ${usePrazo ? 'bg-orange-500 border-orange-500 text-white' : 'border-border text-muted-foreground hover:border-orange-500/50'}`}>
            Por prazo de retorno
          </button>
        </div>

        {!usePrazo ? (
          /* Direct hours input */
          <div>
            <label className="text-xs text-muted-foreground">{eq.expectedLifespan}</label>
            <input className={INPUT + ' mt-1'} type="number" min={100} step={100}
              value={form.lifespan_hours}
              onChange={e => setForm(f => ({ ...f, lifespan_hours: +e.target.value }))} />
          </div>
        ) : (
          /* Payback helper */
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">
              Em quanto tempo você quer recuperar o investimento?
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground">Prazo (meses)</label>
                <input
                  type="number" min={1} step={1}
                  value={paybackMonths}
                  onChange={e => {
                    const v = +e.target.value
                    setPaybackMonths(v)
                    applyPrazo(v, hoursPerDay)
                  }}
                  className={INPUT + ' mt-0.5 h-8 text-sm'}
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Uso médio (h/dia)</label>
                <input
                  type="number" min={0.5} step={0.5} max={24}
                  value={hoursPerDay}
                  onChange={e => {
                    const v = +e.target.value
                    setHoursPerDay(v)
                    applyPrazo(paybackMonths, v)
                  }}
                  className={INPUT + ' mt-0.5 h-8 text-sm'}
                />
              </div>
            </div>
            <div className="rounded-md bg-orange-500/10 px-3 py-2 text-xs space-y-0.5">
              <p className="text-muted-foreground">
                {paybackMonths} meses × 30 dias × {hoursPerDay}h =
                <span className="font-semibold text-foreground ml-1">{form.lifespan_hours.toLocaleString()}h totais</span>
              </p>
              {form.purchase_value > 0 && form.lifespan_hours > 0 && (
                <p className="text-orange-400 font-mono">
                  → taxa: {fmtCurrency(form.purchase_value / form.lifespan_hours)}/h de impressão
                </p>
              )}
            </div>
          </div>
        )}

        {/* Cost per hour preview (for direct mode) */}
        {!usePrazo && form.purchase_value > 0 && form.lifespan_hours > 0 && (
          <p className="text-xs text-orange-400 font-mono">
            → {eq.costPerHour}: {fmtCurrency(form.purchase_value / form.lifespan_hours)}/h
          </p>
        )}

        {form.purchase_value > 0 && (
          <p className="text-xs text-green-400">✓ A purchase expense will be recorded automatically.</p>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-3">
        <button onClick={() => setOpen(false)} className="flex-1 rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted transition-colors">{t.common.cancel}</button>
        <button onClick={handleAdd} disabled={saving}
          className="flex-1 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 transition-colors">
          {saving ? t.common.adding : eq.addPrinter}
        </button>
      </div>
    </div>
  )
}

// ── Recalculate Products Modal ─────────────────────────────────
function RecalculateModal({
  defaultDailyRate,
  defaultWorkingHours,
  onClose,
}: {
  defaultDailyRate: number
  defaultWorkingHours: number
  onClose: () => void
}) {
  const { fmtCurrency } = useT()
  const [dailyRate,    setDailyRate]    = useState(defaultDailyRate || 150)
  const [workingHours, setWorkingHours] = useState(defaultWorkingHours || 20)
  const [failureRate,  setFailureRate]  = useState(10)
  const [spoolPrice,   setSpoolPrice]   = useState(20)
  const [spoolWeight,  setSpoolWeight]  = useState(1000)
  const [running, setRunning] = useState(false)
  const [result,  setResult]  = useState<number | null>(null)

  const effectiveRate   = dailyRate / Math.max(workingHours, 1)
  const previewFilament = 50 * (spoolPrice / Math.max(spoolWeight, 1)) * (1 + failureRate / 100)
  const previewMachine  = 3 * effectiveRate
  const previewPrice    = previewFilament + previewMachine

  async function handleRun() {
    setRunning(true)
    try {
      const count = await recalculateProductCosts({
        dailyRate,
        workingHoursPerDay: workingHours,
        failureRate,
        defaultSpoolPrice:  spoolPrice,
        defaultSpoolWeight: spoolWeight,
      })
      setResult(count)
    } catch { /* silent */ } finally {
      setRunning(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-background shadow-2xl flex flex-col max-h-[92vh]">

        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-base">Recalcular preços — modelo diária</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-5" /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {result !== null ? (
            <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-center space-y-1">
              <CheckCircle2 className="size-6 text-green-400 mx-auto" />
              <p className="font-semibold text-green-400">{result} produtos atualizados!</p>
              <p className="text-xs text-muted-foreground">Acesse Produtos para ver os novos preços.</p>
            </div>
          ) : (
            <>
              {/* Machine daily rate */}
              <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-4 space-y-3">
                <p className="text-xs font-semibold text-orange-400 uppercase tracking-wide">Diária da máquina</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Meta diária ($)</label>
                    <CurrencyInput value={dailyRate} onChange={setDailyRate} className={INPUT + ' mt-1 h-9'} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Horas ativas / dia</label>
                    <input type="number" min={1} max={24} step={0.5} className={INPUT + ' mt-1 h-9'}
                      value={workingHours} onChange={e => setWorkingHours(+e.target.value)} />
                  </div>
                </div>
                <div className="rounded-md bg-orange-500/10 px-3 py-2 text-xs font-mono text-orange-400 space-y-0.5">
                  <p>Taxa efetiva: <strong>{fmtCurrency(effectiveRate)}/h</strong></p>
                  <p className="text-muted-foreground">
                    Produto de 8h usa {((8 / workingHours) * 100).toFixed(0)}% do dia
                    → máquina: {fmtCurrency(8 * effectiveRate)}
                  </p>
                </div>
              </div>

              {/* Materials */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Material</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Carretel ($)</label>
                    <input type="number" min={1} step={1} className={INPUT + ' mt-1 h-8 text-sm'}
                      value={spoolPrice} onChange={e => setSpoolPrice(+e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Peso (g)</label>
                    <input type="number" min={100} step={50} className={INPUT + ' mt-1 h-8 text-sm'}
                      value={spoolWeight} onChange={e => setSpoolWeight(+e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Taxa falha (%)</label>
                    <input type="number" min={0} max={50} step={1} className={INPUT + ' mt-1 h-8 text-sm'}
                      value={failureRate} onChange={e => setFailureRate(+e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div className="rounded-lg bg-muted/40 p-3 text-xs space-y-1">
                <p className="font-medium text-muted-foreground uppercase tracking-wide text-[10px]">
                  Preview — produto exemplo (50g · 3h · 1 impressora)
                </p>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Filamento (c/ {failureRate}% falha)</span>
                  <span className="font-mono">{fmtCurrency(previewFilament)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Máquina (3h × {fmtCurrency(effectiveRate)}/h)</span>
                  <span className="font-mono">{fmtCurrency(previewMachine)}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-1 font-semibold text-orange-400">
                  <span>Preço mínimo</span>
                  <span className="font-mono">{fmtCurrency(previewPrice)}</span>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground/60">
                ⚠️ Vai sobrescrever custo e preço de todos os produtos. Faixas de volume são preservadas.
                Produtos com impressora vinculada usam a diária daquela impressora.
              </p>
            </>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-border">
          <button onClick={onClose}
            className="flex-1 rounded-md border border-border py-2 text-sm hover:bg-muted transition-colors">
            {result !== null ? 'Fechar' : 'Cancelar'}
          </button>
          {result === null && (
            <button onClick={handleRun} disabled={running || dailyRate <= 0}
              className="flex-1 rounded-md bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-2 text-sm font-medium transition-colors">
              {running ? 'Recalculando…' : 'Recalcular todos os produtos'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────
export default function PrintersPage() {
  const { t, fmtCurrency } = useT()
  const eq = t.equipment
  const [printers, setPrinters]     = useState<PrinterRow[]>([])
  const [partners, setPartners]     = useState<Partner[]>([])
  const [loading, setLoading]       = useState(true)
  const [limit, setLimit]           = useState(TRIAL_PRINTER_LIMIT)
  const [amortMap, setAmortMap]     = useState<Record<string, AmortPrinter>>({})
  const [showRecalc, setShowRecalc] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [rows, plist, profile, amort] = await Promise.all([
          getUserPrinters(),
          getPartners(),
          getProfile(),
          getAmortizationData(),
        ])
        setPrinters((rows ?? []) as PrinterRow[])
        setPartners((plist ?? []) as Partner[])
        setLimit(profile?.printer_limit ?? TRIAL_PRINTER_LIMIT)

        // Build amort map keyed by printer id
        const map: Record<string, AmortPrinter> = {}
        for (const p of amort.printers) {
          map[p.id] = { id: p.id, amortizedValue: p.amortizedValue, remaining: p.remaining, pct: p.pct }
        }
        setAmortMap(map)
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
          <h1 className="text-2xl font-bold">{eq.title}</h1>
          <p className="text-muted-foreground mt-1">{eq.subtitle}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {printers.length > 0 && (
            <button onClick={() => setShowRecalc(true)}
              className="flex items-center gap-1.5 text-xs font-medium border border-border px-3 py-1.5 rounded-lg hover:bg-muted hover:border-orange-500/50 hover:text-orange-400 transition-colors">
              <BarChart3 className="size-3.5" /> Recalculate products
            </button>
          )}
          <span className="text-sm text-muted-foreground bg-muted px-3 py-1.5 rounded-full font-medium">
            {printers.length} / {displayLimit}
          </span>
        </div>
      </div>

      {showRecalc && (
        <RecalculateModal
          defaultDailyRate={printers[0]?.daily_rate ?? 0}
          defaultWorkingHours={printers[0]?.working_hours_per_day ?? 20}
          onClose={() => setShowRecalc(false)}
        />
      )}

      {/* Fleet summary */}
      {printers.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-card px-5 py-4">
            <p className="text-xs text-muted-foreground">{eq.fleetValue}</p>
            <p className="text-xl font-bold mt-0.5">{fmtCurrency(totalValue)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card px-5 py-4">
            <p className="text-xs text-muted-foreground">{eq.printers}</p>
            <p className="text-xl font-bold mt-0.5">{printers.length}</p>
          </div>
          <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 px-5 py-4">
            <p className="text-xs text-orange-400/80">{eq.totalCostHour}</p>
            <p className="text-xl font-bold mt-0.5 text-orange-500">{fmtCurrency(totalCph)}</p>
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
            amortPrinter={amortMap[printer.id]}
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
