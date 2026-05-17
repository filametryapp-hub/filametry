'use client'

import { useState, useEffect, useTransition } from 'react'
import { Plus, Pencil, Trash2, Receipt } from 'lucide-react'
import { getExpenses, createExpense, updateExpense, deleteExpense, getExpenseSummary } from '@/lib/actions/expenses'
import { getSuppliers } from '@/lib/actions/suppliers'

type Expense = {
  id: string
  category: string
  description: string
  amount: number
  paid_at: string
  supplier_id?: string | null
  notes?: string | null
  suppliers?: { name: string } | null
}

type Supplier = { id: string; name: string }

const CATEGORIES = ['material', 'office', 'equipment', 'maintenance', 'other']

const INPUT = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors placeholder:text-muted-foreground'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
      {children}
    </div>
  )
}

function ExpenseModal({
  initial,
  suppliers,
  onSave,
  onClose,
  saving,
}: {
  initial?: Expense | null
  suppliers: Supplier[]
  onSave: (data: Omit<Expense, 'suppliers'>) => void
  onClose: () => void
  saving: boolean
}) {
  const today = new Date().toISOString().split('T')[0]
  const [category, setCategory] = useState(initial?.category ?? 'material')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [amount, setAmount] = useState(initial?.amount?.toString() ?? '')
  const [paidAt, setPaidAt] = useState(initial?.paid_at ?? today)
  const [supplierId, setSupplierId] = useState(initial?.supplier_id ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4">
        <h2 className="font-semibold text-lg">{initial?.id ? 'Edit expense' : 'Add expense'}</h2>

        <Field label="Category *">
          <select className={INPUT} value={category} onChange={e => setCategory(e.target.value)}>
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
        </Field>

        <Field label="Description *">
          <input className={INPUT} value={description} onChange={e => setDescription(e.target.value)} placeholder="What was this expense for?" />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Amount (USD) *">
            <input className={INPUT} type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
          </Field>
          <Field label="Date *">
            <input className={INPUT} type="date" value={paidAt} onChange={e => setPaidAt(e.target.value)} />
          </Field>
        </div>

        <Field label="Supplier (optional)">
          <select className={INPUT} value={supplierId} onChange={e => setSupplierId(e.target.value)}>
            <option value="">— None —</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>

        <Field label="Notes">
          <textarea className={`${INPUT} resize-none h-16`} value={notes} onChange={e => setNotes(e.target.value)} />
        </Field>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">
            Cancel
          </button>
          <button
            onClick={() => {
              if (!description.trim() || !amount) return
              onSave({
                id: initial?.id ?? '',
                category,
                description,
                amount: parseFloat(amount),
                paid_at: paidAt,
                supplier_id: supplierId || null,
                notes: notes || null,
              })
            }}
            disabled={saving || !description.trim() || !amount}
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save expense'}
          </button>
        </div>
      </div>
    </div>
  )
}

const CAT_TABS = ['all', ...CATEGORIES]

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [summary, setSummary] = useState<{ category: string; total: number }[]>([])
  const [activeTab, setActiveTab] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    Promise.all([
      getExpenses(),
      getSuppliers(),
      getExpenseSummary(),
    ]).then(([e, s, sum]) => {
      setExpenses((e as Expense[]) ?? [])
      setSuppliers((s as Supplier[]) ?? [])
      setSummary(sum ?? [])
    })
  }, [])

  const filtered = activeTab === 'all' ? expenses : expenses.filter(e => e.category === activeTab)
  const monthTotal = summary.reduce((s, r) => s + r.total, 0)

  function reload() {
    Promise.all([getExpenses(), getExpenseSummary()]).then(([e, sum]) => {
      setExpenses((e as Expense[]) ?? [])
      setSummary(sum ?? [])
    })
  }

  function handleSave(data: Omit<Expense, 'suppliers'>) {
    startTransition(async () => {
      if (data.id) {
        await updateExpense(data.id, {
          category: data.category,
          description: data.description,
          amount: data.amount,
          paid_at: data.paid_at,
          supplier_id: data.supplier_id ?? undefined,
          notes: data.notes ?? undefined,
        })
      } else {
        await createExpense({
          category: data.category,
          description: data.description,
          amount: data.amount,
          paid_at: data.paid_at,
          supplier_id: data.supplier_id ?? undefined,
          notes: data.notes ?? undefined,
        })
      }
      reload()
      setShowForm(false)
      setEditing(null)
    })
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this expense?')) return
    startTransition(async () => {
      await deleteExpense(id)
      reload()
    })
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Expenses</h1>
        <p className="text-muted-foreground mt-1">Track all company spending.</p>
      </div>

      {/* Monthly total */}
      <div className="rounded-xl border border-border bg-card px-6 py-4 mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">This month</p>
          <p className="text-2xl font-bold text-orange-500 mt-0.5">{fmt(monthTotal)}</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true) }}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="size-4" /> Add expense
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 mb-4 border-b border-border">
        {CAT_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors capitalize -mb-px ${
              activeTab === tab
                ? 'border-orange-500 text-orange-500'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <Receipt className="size-8 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-sm text-muted-foreground">No expenses found.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                {['Date', 'Category', 'Description', 'Amount', 'Supplier', 'Actions'].map(h => (
                  <th key={h} className={`px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide ${h === 'Actions' ? 'text-right' : ''} ${h === 'Amount' ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(e => (
                <tr key={e.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground tabular-nums">{e.paid_at}</td>
                  <td className="px-4 py-3">
                    <span className="capitalize text-xs bg-muted px-2 py-0.5 rounded-full">{e.category}</span>
                  </td>
                  <td className="px-4 py-3">{e.description}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">{fmt(Number(e.amount))}</td>
                  <td className="px-4 py-3 text-muted-foreground">{e.suppliers?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => { setEditing(e); setShowForm(true) }} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                        <Pencil className="size-3.5" />
                      </button>
                      <button onClick={() => handleDelete(e.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors">
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <ExpenseModal
          initial={editing}
          suppliers={suppliers}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditing(null) }}
          saving={isPending}
        />
      )}
    </div>
  )
}
