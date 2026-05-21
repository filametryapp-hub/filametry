'use client'

import { useState, useEffect } from 'react'
import { X, Plus, Trash2, FlaskConical, Clock, Package } from 'lucide-react'
import { createExpense, deleteExpense } from '@/lib/actions/expenses'
import { getTestPrints, getTestSettings, saveTestSettings } from '@/lib/actions/printers'
import { consumeFilamentG, getFilamentSpools } from '@/lib/actions/filaments'
import { CurrencyInput } from '@/components/ui/currency-input'
import { useT } from '@/lib/i18n'

type TestPrintEntry = { id: string; description: string; amount: number; paid_at: string; notes?: string; usedG?: number }
type Spool = { id: string; label: string; remaining_g: number }

const INPUT = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors placeholder:text-muted-foreground'
const NUM_INPUT = 'w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-center font-semibold outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'

interface Props {
  prefillProduct?: string | null
  prefillCost?: number | null
  prefillWeightG?: number | null
  onClose: () => void
}

export function TestPrintsModal({ prefillProduct, prefillCost, prefillWeightG, onClose }: Props) {
  const { t, fmtCurrency } = useT()
  const tm = t.testModal

  const [testPrints, setTestPrints] = useState<TestPrintEntry[]>([])
  const [spools, setSpools]         = useState<Spool[]>([])
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')

  const [paybackMonths,  setPaybackMonths]  = useState<number>(6)
  const [hoursPerDay,    setHoursPerDay]    = useState<number>(4)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsSaved,  setSettingsSaved]  = useState(false)

  const [showForm, setShowForm] = useState(Boolean(prefillProduct))

  const [form, setForm] = useState({
    description: prefillProduct ?? '',
    amount:      prefillCost && prefillCost > 0 ? parseFloat(prefillCost.toFixed(2)) : 0,
    paid_at:     new Date().toISOString().slice(0, 10),
    notes:       '',
    paid_by:     'company' as 'company' | 'partner',
    spoolId:     '',
    usedG:       prefillWeightG && prefillWeightG > 0 ? parseFloat(prefillWeightG.toFixed(1)) : 0,
  })

  useEffect(() => {
    async function load() {
      try {
        const [tests, settings, spoolList] = await Promise.all([
          getTestPrints(),
          getTestSettings(),
          getFilamentSpools(),
        ])
        setTestPrints((tests ?? []) as TestPrintEntry[])
        setSpools(spoolList)
        if (settings.months)      setPaybackMonths(settings.months)
        if (settings.hoursPerDay) setHoursPerDay(settings.hoursPerDay)
      } catch { /* silent */ } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const totalWaste   = testPrints.reduce((s, e) => s + e.amount, 0)
  const targetHours  = paybackMonths * 30 * hoursPerDay
  const overheadRate = targetHours > 0 && totalWaste > 0 ? totalWaste / targetHours : 0
  const selectedSpool = spools.find(s => s.id === form.spoolId)

  async function handleSaveSettings() {
    setSavingSettings(true)
    try {
      await saveTestSettings(paybackMonths, hoursPerDay)
      setSettingsSaved(true)
      setTimeout(() => setSettingsSaved(false), 2000)
    } finally {
      setSavingSettings(false)
    }
  }

  async function handleAdd() {
    if (!form.description || !form.amount) { setError(tm.descRequired); return }
    setSaving(true)
    setError('')
    try {
      const notesWithSpool = [
        form.notes || '',
        form.spoolId && form.usedG > 0 ? `filament_spool_id:${form.spoolId}|used_g:${form.usedG}` : '',
      ].filter(Boolean).join(' | ')

      await createExpense({
        category: 'test_print', description: form.description,
        amount: form.amount, paid_at: form.paid_at,
        notes: notesWithSpool || undefined, paid_by: form.paid_by,
      })

      if (form.spoolId && form.usedG > 0) {
        await consumeFilamentG(form.spoolId, form.usedG)
        setSpools(prev => prev.map(s =>
          s.id === form.spoolId ? { ...s, remaining_g: Math.max(0, s.remaining_g - form.usedG) } : s
        ))
      }

      setTestPrints(prev => [{
        id: crypto.randomUUID(), description: form.description,
        amount: form.amount, paid_at: form.paid_at,
        notes: form.notes || undefined,
        usedG: form.usedG > 0 ? form.usedG : undefined,
      }, ...prev])

      setForm({ description: '', amount: 0, paid_at: new Date().toISOString().slice(0, 10), notes: '', paid_by: 'company', spoolId: '', usedG: 0 })
      setShowForm(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : t.common.error)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    await deleteExpense(id)
    setTestPrints(prev => prev.filter(e => e.id !== id))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-background shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-red-500/10 shrink-0">
              <FlaskConical className="size-4 text-red-400" />
            </div>
            <div>
              <p className="font-semibold text-sm">{tm.title}</p>
              {!loading && (
                <p className="text-xs text-muted-foreground">
                  {tm.total}: <span className="font-medium text-foreground">{fmtCurrency(totalWaste)}</span>
                  {overheadRate > 0 && (
                    <span className="ml-2 text-orange-400">
                      · {tm.overhead}: <span className="font-mono">{fmtCurrency(overheadRate)}/h</span>
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!showForm && (
              <button onClick={() => setShowForm(true)}
                className="flex items-center gap-1.5 text-xs text-orange-500 hover:text-orange-400 border border-orange-500/30 rounded-md px-2.5 py-1.5 transition-colors">
                <Plus className="size-3.5" /> {tm.logEntry}
              </button>
            )}
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

          {/* Payback period */}
          <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-3 space-y-3">
            <div className="flex items-center gap-1.5">
              <Clock className="size-3.5 text-orange-400 shrink-0" />
              <p className="text-xs font-semibold text-orange-400 uppercase tracking-wider">{tm.paybackPeriod}</p>
            </div>

            <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground block text-center">{tm.months}</label>
                <input type="number" min={1} max={120} step={1}
                  value={paybackMonths}
                  onChange={e => setPaybackMonths(Math.max(1, +e.target.value))}
                  className={NUM_INPUT} />
              </div>
              <span className="text-muted-foreground text-[10px] pt-4">×</span>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground block text-center">{tm.hoursPerDay}</label>
                <input type="number" min={0.5} max={24} step={0.5}
                  value={hoursPerDay}
                  onChange={e => setHoursPerDay(Math.max(0.5, +e.target.value))}
                  className={NUM_INPUT} />
              </div>
              <span className="text-muted-foreground text-[10px] pt-4">30d</span>
            </div>

            <div className="rounded-md bg-background border border-border px-3 py-2 text-xs space-y-0.5">
              <p className="text-muted-foreground">
                {paybackMonths} × 30 × {hoursPerDay}h = <span className="font-semibold text-foreground">{targetHours.toLocaleString()} {tm.targetHours}</span>
              </p>
              {totalWaste > 0 && targetHours > 0 && (
                <p className="text-orange-400 font-mono font-semibold">
                  {tm.overheadApplied.replace('Overhead:', `${fmtCurrency(overheadRate)}/h`)}
                </p>
              )}
              {totalWaste === 0 && <p className="text-muted-foreground/60">{tm.registerWaste}</p>}
            </div>

            <button onClick={handleSaveSettings} disabled={savingSettings}
              className="w-full text-xs font-medium py-1.5 rounded-md border border-orange-500/40 text-orange-500 hover:bg-orange-500/10 disabled:opacity-50 transition-colors">
              {savingSettings ? tm.saving : settingsSaved ? tm.saved : tm.saveSettings}
            </button>
          </div>

          {/* Add form */}
          {showForm && (
            <div className="rounded-lg border border-border p-3 space-y-3 bg-muted/20">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tm.newEntry}</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground">{tm.description}</label>
                  <input className={INPUT + ' mt-1 text-xs py-1.5'}
                    placeholder="e.g. Adhesion failure — miniature A"
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{tm.materialCost}</label>
                  <CurrencyInput value={form.amount} onChange={v => setForm(f => ({ ...f, amount: v }))}
                    className={INPUT + ' mt-1 text-xs py-1.5'} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{tm.date}</label>
                  <input type="date" className={INPUT + ' mt-1 text-xs py-1.5'}
                    value={form.paid_at}
                    onChange={e => setForm(f => ({ ...f, paid_at: e.target.value }))} />
                </div>

                {/* Filament spool */}
                <div className="col-span-2 rounded-md border border-border bg-background p-2.5 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Package className="size-3 text-muted-foreground" />
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{tm.filamentUsed}</span>
                  </div>
                  <div className="grid grid-cols-[1fr_80px] gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground">{tm.spool}</label>
                      <select value={form.spoolId}
                        onChange={e => setForm(f => ({ ...f, spoolId: e.target.value }))}
                        className="mt-0.5 w-full h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500">
                        <option value="">{tm.noSpool}</option>
                        {spools.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">{tm.grams}</label>
                      <input type="number" min={0} step={0.1}
                        value={form.usedG || ''} placeholder="0"
                        onChange={e => setForm(f => ({ ...f, usedG: parseFloat(e.target.value) || 0 }))}
                        className="mt-0.5 w-full h-8 rounded-md border border-input bg-background px-2 text-xs text-center font-semibold focus:outline-none focus:ring-1 focus:ring-orange-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                    </div>
                  </div>
                  {selectedSpool && form.usedG > 0 && (
                    <p className="text-[10px] text-orange-400">
                      {tm.stockAfter}: <span className="font-semibold">{Math.max(0, selectedSpool.remaining_g - form.usedG).toFixed(0)}g</span>
                    </p>
                  )}
                  {!form.spoolId && <p className="text-[10px] text-muted-foreground/50">{tm.selectSpool}</p>}
                </div>

                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground">{tm.paidBy}</label>
                  <div className="flex gap-2 mt-1">
                    {(['company', 'partner'] as const).map(opt => (
                      <button key={opt} type="button"
                        onClick={() => setForm(f => ({ ...f, paid_by: opt }))}
                        className={`flex-1 py-1 rounded border text-xs font-medium transition-colors ${
                          form.paid_by === opt
                            ? 'border-red-500 bg-red-500/10 text-red-400'
                            : 'border-border text-muted-foreground hover:border-red-400/40'
                        }`}>
                        {opt === 'company' ? tm.company : tm.partner}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground">{tm.observations}</label>
                  <input className={INPUT + ' mt-1 text-xs py-1.5'} placeholder="Optional…"
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <div className="flex gap-2">
                <button onClick={() => { setShowForm(false); setError('') }}
                  className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted transition-colors">
                  {tm.cancel}
                </button>
                <button onClick={handleAdd} disabled={saving}
                  className="text-xs px-3 py-1.5 rounded-md bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 transition-colors">
                  {saving ? tm.registering : tm.register}
                </button>
              </div>
            </div>
          )}

          {/* List */}
          {loading ? (
            <div className="flex justify-center py-6">
              <div className="size-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : testPrints.length === 0 && !showForm ? (
            <p className="text-xs text-muted-foreground text-center py-4">{tm.noEntries}</p>
          ) : testPrints.length > 0 ? (
            <div className="rounded-lg border border-border divide-y divide-border">
              {testPrints.map(entry => (
                <div key={entry.id} className="flex items-center justify-between px-3 py-2.5 text-xs">
                  <div className="min-w-0">
                    <span className="font-medium truncate block">{entry.description}</span>
                    <span className="text-muted-foreground">{entry.paid_at}</span>
                    {entry.usedG && <span className="text-muted-foreground/70 block">{entry.usedG}g filament</span>}
                    {entry.notes && <span className="text-muted-foreground/70 block truncate">{entry.notes}</span>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <span className="font-mono font-semibold text-red-400">{fmtCurrency(entry.amount)}</span>
                    <button onClick={() => handleDelete(entry.id)}
                      className="text-muted-foreground hover:text-red-400 transition-colors">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
