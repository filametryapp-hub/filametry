'use client'

import { useState, useEffect, useTransition, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, Receipt, Package, Cpu, Layers, Wrench, MoreHorizontal } from 'lucide-react'
import { getExpenses, createExpense, updateExpense, deleteExpense, getExpenseSummary } from '@/lib/actions/expenses'
import { getSuppliers } from '@/lib/actions/suppliers'
import { getPartners } from '@/lib/actions/company'
import { getPaymentMethods, type PaymentMethodRow } from '@/lib/actions/payment-methods'
import { useT } from '@/lib/i18n'
import { CurrencyInput } from '@/components/ui/currency-input'

// ── Types ──────────────────────────────────────────────────────
type Expense = {
  id: string
  category: string
  description: string
  amount: number
  paid_at: string
  payment_method?: string | null
  paid_by?: string | null
  supplier_id?: string | null
  notes?: string | null
  suppliers?: { name: string } | null
}

type Supplier = { id: string; name: string }
type Partner  = { id: string; name: string }

const CATEGORIES = ['material', 'post_processing', 'equipment', 'packaging', 'other'] as const

const CAT_ICONS: Record<string, React.ElementType> = {
  material:       Layers,
  post_processing: Wrench,
  equipment:      Cpu,
  packaging:      Package,
  other:          MoreHorizontal,
}

const CAT_COLORS: Record<string, string> = {
  material:        'bg-blue-500/10 text-blue-500',
  post_processing: 'bg-purple-500/10 text-purple-500',
  equipment:       'bg-orange-500/10 text-orange-500',
  packaging:       'bg-green-500/10 text-green-500',
  other:           'bg-muted text-muted-foreground',
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

// ── Modal ───────────────────────────────────────────────────────
function ExpenseModal({
  initial,
  suppliers,
  partners,
  paymentMethods,
  defaultCategory,
  onSave,
  onClose,
  saving,
}: {
  initial?: Expense | null
  suppliers: Supplier[]
  partners: Partner[]
  paymentMethods: PaymentMethodRow[]
  defaultCategory?: string
  onSave: (data: Omit<Expense, 'suppliers'>) => void
  onClose: () => void
  saving: boolean
}) {
  const { t, currencySymbol } = useT()
  const ex = t.expenses
  const today = new Date().toISOString().split('T')[0]

  const [category,      setCategory]      = useState(initial?.category ?? defaultCategory ?? 'material')
  const [description,   setDescription]   = useState(initial?.description ?? '')
  const [amount,        setAmount]        = useState<number>(initial?.amount ?? 0)
  const [paidAt,        setPaidAt]        = useState(initial?.paid_at ?? today)
  const [paymentMethod, setPaymentMethod] = useState(initial?.payment_method ?? '')
  const [paidBy,        setPaidBy]        = useState(initial?.paid_by ?? 'company')
  const [supplierId,    setSupplierId]    = useState(initial?.supplier_id ?? '')
  const [notes,         setNotes]         = useState(initial?.notes ?? '')

  // Paid-by options: Empresa + each partner
  const paidByOptions = [
    { value: 'company', label: '🏢 Empresa' },
    ...partners.map(p => ({ value: p.name, label: `🤝 ${p.name}` })),
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
        <h2 className="font-semibold text-lg">
          {initial?.id ? t.common.edit : ex.addExpense}
        </h2>

        {/* Category pills */}
        <Field label={`${ex.category} *`}>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map(c => {
              const Icon = CAT_ICONS[c]
              const label = (ex.cats as Record<string, string>)[c] ?? c
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-full border font-medium transition-colors ${
                    category === c
                      ? 'border-blue-600 bg-blue-600/10 text-blue-600'
                      : 'border-border text-muted-foreground hover:border-blue-600/40'
                  }`}
                >
                  <Icon className="size-3" />
                  {label}
                </button>
              )
            })}
          </div>
        </Field>

        {/* Description */}
        <Field label="Descrição *">
          <input
            className={INPUT}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Ex: Filamento PLA preto 1kg, Lixa d'água, Impressora Bambu X1..."
            autoFocus
          />
        </Field>

        {/* Amount + Date */}
        <div className="grid grid-cols-2 gap-3">
          <Field label={`${ex.amount} *`}>
            <CurrencyInput value={amount} onChange={setAmount} className={INPUT} />
          </Field>
          <Field label={`${ex.paidAt} *`}>
            <input className={INPUT} type="date" value={paidAt} onChange={e => setPaidAt(e.target.value)} />
          </Field>
        </div>

        {/* Payment method + Paid by */}
        <div className="grid grid-cols-2 gap-3">
          <Field label={ex.paymentMethod}>
            <select className={INPUT} value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
              <option value="">— selecionar —</option>
              {paymentMethods.map(m => (
                <option key={m.id} value={m.label}>{m.label}</option>
              ))}
            </select>
          </Field>
          <Field label={ex.paidBy}>
            <select className={INPUT} value={paidBy} onChange={e => setPaidBy(e.target.value)}>
              {paidByOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>
        </div>

        {/* Supplier */}
        {suppliers.length > 0 && (
          <Field label={ex.supplier}>
            <select className={INPUT} value={supplierId} onChange={e => setSupplierId(e.target.value)}>
              <option value="">— nenhum —</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
        )}

        {/* Notes */}
        <Field label={t.common.notes}>
          <textarea
            className={`${INPUT} resize-none h-14`}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Observações opcionais..."
          />
        </Field>

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            {t.common.cancel}
          </button>
          <button
            onClick={() => {
              if (!description.trim() || amount <= 0) return
              onSave({
                id:             initial?.id ?? '',
                category,
                description:    description.trim(),
                amount,
                paid_at:        paidAt,
                payment_method: paymentMethod || null,
                paid_by:        paidBy,
                supplier_id:    supplierId || null,
                notes:          notes.trim() || null,
              })
            }}
            disabled={saving || !description.trim() || amount <= 0}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? t.common.saving : t.common.save}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Inner page (uses searchParams) ─────────────────────────────
function ExpensesInner() {
  const { t, fmtCurrency } = useT()
  const ex = t.expenses
  const searchParams = useSearchParams()
  const router = useRouter()

  const [expenses,       setExpenses]       = useState<Expense[]>([])
  const [suppliers,      setSuppliers]      = useState<Supplier[]>([])
  const [partners,       setPartners]       = useState<Partner[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRow[]>([])
  const [summary,        setSummary]        = useState<{ category: string; total: number }[]>([])
  const [activeTab,      setActiveTab]      = useState('all')
  const [showForm,       setShowForm]       = useState(false)
  const [editing,        setEditing]        = useState<Expense | null>(null)
  const [defaultCat,     setDefaultCat]     = useState<string>('material')
  const [loading,        setLoading]        = useState(true)
  const [isPending,      startTransition]   = useTransition()

  useEffect(() => {
    // Support ?category=material&open=1 from other pages
    const cat = searchParams.get('category')
    const open = searchParams.get('open')
    if (cat) { setActiveTab(cat); setDefaultCat(cat) }
    if (open === '1') {
      setShowForm(true)
      // Clean URL so navigating back doesn't re-open the form
      router.replace('/expenses' + (cat ? `?category=${cat}` : ''))
    }

    Promise.all([
      getExpenses(),
      getSuppliers(),
      getExpenseSummary(),
      getPartners().catch(() => []),
      getPaymentMethods().catch(() => []),
    ]).then(([e, s, sum, p, pm]) => {
      setExpenses((e as Expense[]) ?? [])
      setSuppliers((s as Supplier[]) ?? [])
      setSummary(sum ?? [])
      setPartners((p ?? []) as Partner[])
      setPaymentMethods(pm)
    }).finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const CAT_TABS = ['all', ...CATEGORIES]
  const visibleExpenses = expenses.filter(e => e.category !== 'test_print')
  const filtered = activeTab === 'all'
    ? visibleExpenses
    : visibleExpenses.filter(e => e.category === activeTab)

  const monthTotal = summary.filter(r => r.category !== 'test_print').reduce((s, r) => s + r.total, 0)

  function reload() {
    Promise.all([getExpenses(), getExpenseSummary()]).then(([e, sum]) => {
      setExpenses((e as Expense[]) ?? [])
      setSummary(sum ?? [])
    })
  }

  function openNew(cat?: string) {
    setEditing(null)
    setDefaultCat(cat ?? activeTab === 'all' ? 'material' : activeTab)
    setShowForm(true)
    // Remove URL params so they don't re-trigger on next render
    router.replace('/expenses')
  }

  function handleSave(data: Omit<Expense, 'suppliers'>) {
    startTransition(async () => {
      if (data.id) {
        await updateExpense(data.id, {
          category:       data.category,
          description:    data.description,
          amount:         data.amount,
          paid_at:        data.paid_at,
          payment_method: data.payment_method ?? undefined,
          paid_by:        data.paid_by ?? 'company',
          supplier_id:    data.supplier_id,
          notes:          data.notes,
        })
      } else {
        await createExpense({
          category:       data.category,
          description:    data.description,
          amount:         data.amount,
          paid_at:        data.paid_at,
          payment_method: data.payment_method ?? undefined,
          paid_by:        data.paid_by ?? 'company',
          supplier_id:    data.supplier_id ?? undefined,
          notes:          data.notes ?? undefined,
        })
      }
      reload()
      setShowForm(false)
      setEditing(null)
    })
  }

  function handleDelete(id: string) {
    if (!confirm('Excluir este lançamento?')) return
    startTransition(async () => {
      await deleteExpense(id)
      reload()
    })
  }

  // Summary by category for this month
  const catSummary = CATEGORIES.map(c => ({
    cat: c,
    total: summary.find(r => r.category === c)?.total ?? 0,
    label: (ex.cats as Record<string, string>)[c] ?? c,
    Icon: CAT_ICONS[c],
    color: CAT_COLORS[c],
  })).filter(c => c.total > 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="size-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{ex.title}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{ex.subtitle}</p>
        </div>
        <button
          onClick={() => openNew()}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
        >
          <Plus className="size-4" /> {ex.addExpense}
        </button>
      </div>

      {/* Month total + category breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="col-span-2 sm:col-span-1 rounded-xl border border-border bg-card px-5 py-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{ex.totalMonth}</p>
          <p className="text-2xl font-bold text-red-400">{fmtCurrency(monthTotal)}</p>
        </div>
        {catSummary.map(({ cat, total, label, Icon, color }) => (
          <div
            key={cat}
            onClick={() => setActiveTab(cat)}
            className="rounded-xl border border-border bg-card px-4 py-3 cursor-pointer hover:border-blue-600/40 transition-colors"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={`p-1 rounded-md ${color}`}>
                <Icon className="size-3" />
              </span>
              <p className="text-xs text-muted-foreground truncate">{label}</p>
            </div>
            <p className="text-sm font-bold">{fmtCurrency(total)}</p>
          </div>
        ))}
      </div>

      {/* Quick launch buttons */}
      <div className="flex flex-wrap gap-2">
        <p className="text-xs text-muted-foreground self-center mr-1">Lançar rápido:</p>
        {CATEGORIES.map(c => {
          const Icon = CAT_ICONS[c]
          const label = (ex.cats as Record<string, string>)[c] ?? c
          return (
            <button
              key={c}
              onClick={() => openNew(c)}
              className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:border-blue-600/50 hover:text-blue-600 transition-colors"
            >
              <Icon className="size-3" />
              {label}
            </button>
          )
        })}
      </div>

      {/* Category tabs */}
      <div className="flex gap-0 border-b border-border overflow-x-auto">
        {CAT_TABS.map(tab => {
          const label = tab === 'all'
            ? ex.cats.all
            : (ex.cats as Record<string, string>)[tab] ?? tab
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap -mb-px ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
              {tab !== 'all' && (summary.find(r => r.category === tab)?.total ?? 0) > 0 && (
                <span className="ml-1.5 text-[10px] text-muted-foreground tabular-nums">
                  {fmtCurrency(summary.find(r => r.category === tab)!.total)}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <Receipt className="size-8 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-sm text-muted-foreground">{ex.noExpenses}</p>
          <button
            onClick={() => openNew()}
            className="mt-4 text-sm text-blue-600 hover:underline"
          >
            {ex.addExpense}
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                {['Data', 'Categoria', 'Descrição', 'Pago por', 'Pagamento', 'Valor', ''].map((h, i) => (
                  <th
                    key={i}
                    className={`px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide ${
                      h === 'Valor' || h === '' ? 'text-right' : ''
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(e => {
                const Icon = CAT_ICONS[e.category] ?? MoreHorizontal
                const catColor = CAT_COLORS[e.category] ?? CAT_COLORS.other
                const catLabel = (ex.cats as Record<string, string>)[e.category] ?? e.category
                const isPartner = e.paid_by && e.paid_by !== 'company'
                return (
                  <tr key={e.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground tabular-nums text-[12px] whitespace-nowrap">{e.paid_at}</td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full w-fit ${catColor}`}>
                        <Icon className="size-3" />
                        {catLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[220px]">
                      <p className="truncate">{e.description}</p>
                      {e.notes && <p className="text-xs text-muted-foreground truncate">{e.notes}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${isPartner ? 'bg-blue-500/10 text-blue-500' : 'bg-muted text-muted-foreground'}`}>
                        {isPartner ? `🤝 ${e.paid_by}` : '🏢 Empresa'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{e.payment_method ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-red-400">
                      {fmtCurrency(Number(e.amount))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setEditing(e); setDefaultCat(e.category); setShowForm(true) }}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(e.id)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <ExpenseModal
          initial={editing}
          suppliers={suppliers}
          partners={partners}
          paymentMethods={paymentMethods}
          defaultCategory={defaultCat}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditing(null) }}
          saving={isPending}
        />
      )}
    </div>
  )
}

// ── Page wrapper (Suspense for useSearchParams) ─────────────────
export default function ExpensesPage() {
  return (
    <Suspense>
      <ExpensesInner />
    </Suspense>
  )
}
