'use client'

import { useState, useEffect, useTransition } from 'react'
import { Plus, TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import { getCashFlow, getCashFlowSummary, addCashFlowEntry } from '@/lib/actions/cash-flow'
import { useT } from '@/lib/i18n'
import { CurrencyInput } from '@/components/ui/currency-input'

type CashEntry = {
  id: string
  type: string
  category: string
  description: string
  amount: number
  date: string
}

const INPUT = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600/30 transition-colors placeholder:text-muted-foreground'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
      {children}
    </div>
  )
}

function AddIncomeModal({
  onSave,
  onClose,
  saving,
}: {
  onSave: (data: { category: string; description: string; amount: number; date: string }) => void
  onClose: () => void
  saving: boolean
}) {
  const { t, fmtCurrency, currencySymbol } = useT()
  const today = new Date().toISOString().split('T')[0]
  const [category, setCategory] = useState('sales')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState<number>(0)
  const [date, setDate] = useState(today)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4">
        <h2 className="font-semibold text-lg">{t.cashFlow.addEntry}</h2>

        <Field label={t.cashFlow.category}>
          <select className={INPUT} value={category} onChange={e => setCategory(e.target.value)}>
            {['sales', 'service', 'refund', 'other'].map(c => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
        </Field>

        <Field label="Description *">
          <input className={INPUT} value={description} onChange={e => setDescription(e.target.value)} placeholder="Order payment, custom job, etc." />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label={`${t.cashFlow.amount} *`}>
            <CurrencyInput value={amount} onChange={setAmount} className={INPUT} />
          </Field>
          <Field label={`${t.common.date} *`}>
            <input className={INPUT} type="date" value={date} onChange={e => setDate(e.target.value)} />
          </Field>
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">
            {t.common.cancel}
          </button>
          <button
            onClick={() => {
              if (!description.trim() || amount <= 0) return
              onSave({ category, description, amount: amount, date })
            }}
            disabled={saving || !description.trim() || amount <= 0}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? t.common.saving : t.common.add}
          </button>
        </div>
      </div>
    </div>
  )
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function CashFlowPage() {
  const { t, fmtCurrency } = useT()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [entries, setEntries] = useState<CashEntry[]>([])
  const [summary, setSummary] = useState({ income: 0, expenses: 0, balance: 0 })
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTransition] = useTransition()

  function reload(m: number, y: number) {
    Promise.all([getCashFlow(m, y), getCashFlowSummary()]).then(([e, sum]) => {
      setEntries((e as CashEntry[]) ?? [])
      setSummary(sum ?? { income: 0, expenses: 0, balance: 0 })
    })
  }

  useEffect(() => { reload(month, year) }, [month, year])

  function changeMonth(delta: number) {
    let m = month + delta
    let y = year
    if (m < 1) { m = 12; y-- }
    if (m > 12) { m = 1; y++ }
    setMonth(m)
    setYear(y)
  }

  function handleAddIncome(data: { category: string; description: string; amount: number; date: string }) {
    startTransition(async () => {
      await addCashFlowEntry({ ...data, type: 'income' })
      reload(month, year)
      setShowForm(false)
    })
  }

  const positive = summary.balance >= 0

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t.cashFlow.title}</h1>
        <p className="text-muted-foreground mt-1">{t.cashFlow.subtitle}</p>
      </div>

      {/* Month selector */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => changeMonth(-1)} className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted transition-colors">
          ←
        </button>
        <span className="text-sm font-medium min-w-36 text-center">
          {MONTHS[month - 1]} {year}
        </span>
        <button onClick={() => changeMonth(1)} className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted transition-colors">
          →
        </button>
        <div className="flex-1" />
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="size-4" /> {t.cashFlow.addEntry}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="size-4 text-green-400" />
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{t.cashFlow.income}</p>
          </div>
          <p className="text-xl font-bold text-green-400">{fmtCurrency(summary.income)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="size-4 text-red-400" />
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{t.cashFlow.expense}</p>
          </div>
          <p className="text-xl font-bold text-red-400">{fmtCurrency(summary.expenses)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="size-4" style={{ color: positive ? '#FF6B35' : '#f87171' }} />
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{t.cashFlow.balance}</p>
          </div>
          <p className="text-xl font-bold" style={{ color: positive ? '#FF6B35' : '#f87171' }}>
            {fmtCurrency(summary.balance)}
          </p>
        </div>
      </div>

      {/* Entries table */}
      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <Wallet className="size-8 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-sm text-muted-foreground">{t.cashFlow.noEntries}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                {[t.common.date, t.cashFlow.type, t.cashFlow.category, t.cashFlow.description, t.cashFlow.amount].map(h => (
                  <th key={h} className={`px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide ${h === t.cashFlow.amount ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map(e => (
                <tr key={e.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground tabular-nums">{e.date}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${e.type === 'income' ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'}`}>
                      {e.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">{e.category}</td>
                  <td className="px-4 py-3">{e.description}</td>
                  <td className={`px-4 py-3 text-right font-mono font-semibold ${e.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>
                    {e.type === 'income' ? '+' : '-'}{fmtCurrency(Number(e.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <AddIncomeModal
          onSave={handleAddIncome}
          onClose={() => setShowForm(false)}
          saving={isPending}
        />
      )}
    </div>
  )
}
