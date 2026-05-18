'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, FlaskConical } from 'lucide-react'
import { createExpense, deleteExpense } from '@/lib/actions/expenses'
import { getTestPrints, getAmortizationData } from '@/lib/actions/printers'
import { CurrencyInput } from '@/components/ui/currency-input'

type TestPrintEntry = { id: string; description: string; amount: number; paid_at: string; notes?: string }

const INPUT = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors placeholder:text-muted-foreground'

function fmtCurrency(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export function TestPrintsSection({ prefillProduct }: { prefillProduct?: string | null }) {
  const [testPrints, setTestPrints]             = useState<TestPrintEntry[]>([])
  const [totalProductHours, setTotalProductHours] = useState(0)
  const [loading, setLoading]                   = useState(true)
  const [adding, setAdding]                     = useState(false)
  const [saving, setSaving]                     = useState(false)
  const [error, setError]                       = useState('')
  const [form, setForm] = useState({
    description: '',
    amount: 0,
    paid_at: new Date().toISOString().slice(0, 10),
    notes: '',
  })
  const formRef = useRef<HTMLDivElement>(null)

  // Load data once
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

  // When a product card triggers "Registrar Teste", open the form pre-filled
  useEffect(() => {
    if (prefillProduct) {
      setForm(f => ({ ...f, description: prefillProduct }))
      setAdding(true)
      // Scroll to form
      setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80)
    }
  }, [prefillProduct])

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
      })
      const newEntry: TestPrintEntry = {
        id:          crypto.randomUUID(),
        description: form.description,
        amount:      form.amount,
        paid_at:     form.paid_at,
        notes:       form.notes || undefined,
      }
      setTestPrints(prev => [newEntry, ...prev])
      setForm({ description: '', amount: 0, paid_at: new Date().toISOString().slice(0, 10), notes: '' })
      setAdding(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteExpense(id)
      setTestPrints(prev => prev.filter(e => e.id !== id))
    } catch { /* silent */ }
  }

  if (loading) return null

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-red-500/10 shrink-0">
            <FlaskConical className="size-4 text-red-400" />
          </div>
          <div>
            <p className="font-semibold text-sm">Testes &amp; Perdas</p>
            <p className="text-xs text-muted-foreground">
              Custo total: <span className="font-medium text-foreground">{fmtCurrency(totalWaste)}</span>
              {overheadRate > 0 && (
                <span className="ml-2 text-orange-400">
                  · Overhead: <span className="font-mono">{fmtCurrency(overheadRate)}/h</span>
                </span>
              )}
            </p>
          </div>
        </div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 text-xs text-orange-500 hover:text-orange-600 transition-colors"
          >
            <Plus className="size-3.5" /> Registrar teste
          </button>
        )}
      </div>

      <div ref={formRef} className="px-5 py-4 space-y-3">
        {/* Add form */}
        {adding && (
          <div className="rounded-lg border border-border p-3 space-y-3 bg-muted/20">
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
                <label className="text-xs text-muted-foreground">Custo do material perdido *</label>
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
              <button onClick={() => { setAdding(false); setError('') }}
                className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted transition-colors">
                Cancelar
              </button>
              <button onClick={handleAdd} disabled={saving}
                className="text-xs px-3 py-1.5 rounded-md bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 transition-colors">
                {saving ? 'Salvando…' : 'Registrar teste'}
              </button>
            </div>
          </div>
        )}

        {/* List */}
        {testPrints.length === 0 && !adding ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Nenhum teste registrado ainda. Clique em &quot;Registrar teste&quot; ou use o botão em cada produto.
          </p>
        ) : testPrints.length > 0 ? (
          <div className="rounded-lg border border-border divide-y divide-border">
            {testPrints.map(entry => (
              <div key={entry.id} className="flex items-center justify-between px-3 py-2 text-xs">
                <div className="min-w-0">
                  <span className="font-medium truncate block">{entry.description}</span>
                  <span className="text-muted-foreground">{entry.paid_at}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
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
          <p className="text-[11px] text-muted-foreground/60 flex items-start gap-1 pt-1">
            <span className="inline-block size-1.5 rounded-full bg-orange-400 shrink-0 mt-1" />
            O overhead é aplicado automaticamente na precificação proporcional às horas de impressão.
          </p>
        )}
      </div>
    </div>
  )
}
