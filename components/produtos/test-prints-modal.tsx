'use client'

import { useState, useEffect } from 'react'
import { X, Plus, Trash2, FlaskConical } from 'lucide-react'
import { createExpense, deleteExpense } from '@/lib/actions/expenses'
import { getTestPrints, getAmortizationData } from '@/lib/actions/printers'
import { CurrencyInput } from '@/components/ui/currency-input'

type TestPrintEntry = { id: string; description: string; amount: number; paid_at: string; notes?: string }

const INPUT = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors placeholder:text-muted-foreground'

function fmtCurrency(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

interface Props {
  // When opened from a product button, pre-fills the form
  prefillProduct?: string | null
  prefillCost?: number | null
  onClose: () => void
}

export function TestPrintsModal({ prefillProduct, prefillCost, onClose }: Props) {
  const [testPrints, setTestPrints]               = useState<TestPrintEntry[]>([])
  const [totalProductHours, setTotalProductHours] = useState(0)
  const [loading, setLoading]                     = useState(true)
  const [saving, setSaving]                       = useState(false)
  const [error, setError]                         = useState('')

  // Start in "add" mode when coming from a product button
  const [showForm, setShowForm] = useState(Boolean(prefillProduct))

  const [form, setForm] = useState({
    description: prefillProduct ?? '',
    amount:      prefillCost && prefillCost > 0 ? parseFloat(prefillCost.toFixed(2)) : 0,
    paid_at:     new Date().toISOString().slice(0, 10),
    notes:       '',
    paid_by:     'company' as 'company' | 'partner',
  })

  useEffect(() => {
    async function load() {
      try {
        const [tests, amort] = await Promise.all([getTestPrints(), getAmortizationData()])
        setTestPrints((tests ?? []) as TestPrintEntry[])
        setTotalProductHours(amort.totalProductHours)
      } catch { /* silent */ } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const totalWaste   = testPrints.reduce((s, e) => s + e.amount, 0)
  const overheadRate = totalProductHours > 0 && totalWaste > 0 ? totalWaste / totalProductHours : 0

  async function handleAdd() {
    if (!form.description || !form.amount) { setError('Descrição e custo são obrigatórios.'); return }
    setSaving(true)
    setError('')
    try {
      await createExpense({
        category:    'test_print',
        description: form.description,
        amount:      form.amount,
        paid_at:     form.paid_at,
        notes:       form.notes || undefined,
        paid_by:     form.paid_by,
      })
      setTestPrints(prev => [{
        id:          crypto.randomUUID(),
        description: form.description,
        amount:      form.amount,
        paid_at:     form.paid_at,
        notes:       form.notes || undefined,
      }, ...prev])
      setForm({ description: '', amount: 0, paid_at: new Date().toISOString().slice(0, 10), notes: '', paid_by: 'company' })
      setShowForm(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar.')
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
              <p className="font-semibold text-sm">Testes &amp; Perdas</p>
              {!loading && (
                <p className="text-xs text-muted-foreground">
                  Total: <span className="font-medium text-foreground">{fmtCurrency(totalWaste)}</span>
                  {overheadRate > 0 && (
                    <span className="ml-2 text-orange-400">
                      · Overhead: <span className="font-mono">{fmtCurrency(overheadRate)}/h</span>
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-1.5 text-xs text-orange-500 hover:text-orange-400 border border-orange-500/30 rounded-md px-2.5 py-1.5 transition-colors"
              >
                <Plus className="size-3.5" /> Registrar
              </button>
            )}
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

          {/* Add form */}
          {showForm && (
            <div className="rounded-lg border border-border p-3 space-y-3 bg-muted/20">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Novo registro</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground">Descrição *</label>
                  <input
                    className={INPUT + ' mt-1 text-xs py-1.5'}
                    placeholder="ex: Falha de adesão — miniatura A"
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Custo do material *</label>
                  <CurrencyInput
                    value={form.amount}
                    onChange={v => setForm(f => ({ ...f, amount: v }))}
                    className={INPUT + ' mt-1 text-xs py-1.5'}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Data</label>
                  <input
                    type="date"
                    className={INPUT + ' mt-1 text-xs py-1.5'}
                    value={form.paid_at}
                    onChange={e => setForm(f => ({ ...f, paid_at: e.target.value }))}
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground">Pago por</label>
                  <div className="flex gap-2 mt-1">
                    {(['company', 'partner'] as const).map(opt => (
                      <button key={opt} type="button"
                        onClick={() => setForm(f => ({ ...f, paid_by: opt }))}
                        className={`flex-1 py-1 rounded border text-xs font-medium transition-colors ${
                          form.paid_by === opt
                            ? 'border-red-500 bg-red-500/10 text-red-400'
                            : 'border-border text-muted-foreground hover:border-red-400/40'
                        }`}>
                        {opt === 'company' ? '🏢 Empresa' : '🤝 Sócio'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground">Observações</label>
                  <input
                    className={INPUT + ' mt-1 text-xs py-1.5'}
                    placeholder="Opcional…"
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  />
                </div>
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowForm(false); setError('') }}
                  className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAdd}
                  disabled={saving}
                  className="text-xs px-3 py-1.5 rounded-md bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Salvando…' : 'Registrar'}
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
            <p className="text-xs text-muted-foreground text-center py-8">
              Nenhum teste registrado ainda.
            </p>
          ) : testPrints.length > 0 ? (
            <div className="rounded-lg border border-border divide-y divide-border">
              {testPrints.map(entry => (
                <div key={entry.id} className="flex items-center justify-between px-3 py-2.5 text-xs">
                  <div className="min-w-0">
                    <span className="font-medium truncate block">{entry.description}</span>
                    <span className="text-muted-foreground">{entry.paid_at}</span>
                    {entry.notes && <span className="text-muted-foreground/70 block truncate">{entry.notes}</span>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <span className="font-mono font-semibold text-red-400">{fmtCurrency(entry.amount)}</span>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="text-muted-foreground hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {/* Overhead note */}
          {overheadRate > 0 && (
            <p className="text-[11px] text-muted-foreground/60 flex items-start gap-1">
              <span className="inline-block size-1.5 rounded-full bg-orange-400 shrink-0 mt-1" />
              Overhead aplicado automaticamente na precificação ({fmtCurrency(overheadRate)}/h).
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
