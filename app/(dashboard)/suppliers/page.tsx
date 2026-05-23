'use client'

import { useState, useEffect, useTransition } from 'react'
import { Plus, Pencil, Trash2, Search, Truck } from 'lucide-react'
import { getSuppliers, upsertSupplier, deleteSupplier } from '@/lib/actions/suppliers'
import { useT } from '@/lib/i18n'

type Supplier = {
  id: string
  name: string
  contact_name?: string | null
  email?: string | null
  phone?: string | null
  document?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  website?: string | null
  notes?: string | null
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

function SupplierModal({
  initial,
  onSave,
  onClose,
  saving,
}: {
  initial?: Supplier | null
  onSave: (data: Supplier) => void
  onClose: () => void
  saving: boolean
}) {
  const { t } = useT()
  const [form, setForm] = useState<Supplier>(initial ?? {
    id: '', name: '', contact_name: '', email: '', phone: '',
    document: '', address: '', city: '', state: '', country: 'US', website: '', notes: '',
  })
  const set = (k: keyof Supplier, v: string) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl space-y-5 max-h-[90vh] overflow-y-auto">
        <h2 className="font-semibold text-lg">{initial?.id ? t.suppliers.editSupplier : t.suppliers.addSupplier}</h2>

        <Field label={`${t.common.name} *`}>
          <input className={INPUT} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Supplier Co." />
        </Field>

        <Field label={t.suppliers.contactName}>
          <input className={INPUT} value={form.contact_name ?? ''} onChange={e => set('contact_name', e.target.value)} placeholder="Jane Smith" />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label={t.common.email}>
            <input className={INPUT} type="email" value={form.email ?? ''} onChange={e => set('email', e.target.value)} placeholder="contact@supplier.com" />
          </Field>
          <Field label={t.common.phone}>
            <input className={INPUT} value={form.phone ?? ''} onChange={e => set('phone', e.target.value)} placeholder="+1 555 000 0000" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label={t.common.document}>
            <input className={INPUT} value={form.document ?? ''} onChange={e => set('document', e.target.value)} />
          </Field>
          <Field label={t.suppliers.website}>
            <input className={INPUT} value={form.website ?? ''} onChange={e => set('website', e.target.value)} placeholder="https://supplier.com" />
          </Field>
        </div>

        <Field label={t.common.address}>
          <input className={INPUT} value={form.address ?? ''} onChange={e => set('address', e.target.value)} />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label={t.common.city}>
            <input className={INPUT} value={form.city ?? ''} onChange={e => set('city', e.target.value)} />
          </Field>
          <Field label={t.common.state}>
            <input className={INPUT} value={form.state ?? ''} onChange={e => set('state', e.target.value)} />
          </Field>
          <Field label={t.common.country}>
            <input className={INPUT} value={form.country ?? ''} onChange={e => set('country', e.target.value)} />
          </Field>
        </div>

        <Field label={t.common.notes}>
          <textarea className={`${INPUT} resize-none h-20`} value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} />
        </Field>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">
            {t.common.cancel}
          </button>
          <button
            onClick={() => { if (form.name.trim()) onSave(form) }}
            disabled={saving || !form.name.trim()}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? t.common.saving : t.common.save}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SuppliersPage() {
  const { t } = useT()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    getSuppliers().then(data => setSuppliers((data as Supplier[]) ?? []))
  }, [])

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.contact_name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  function handleSave(data: Supplier) {
    startTransition(async () => {
      await upsertSupplier({
        id: data.id || undefined,
        name: data.name,
        contact_name: data.contact_name || undefined,
        email: data.email || undefined,
        phone: data.phone || undefined,
        document: data.document || undefined,
        address: data.address || undefined,
        city: data.city || undefined,
        state: data.state || undefined,
        country: data.country || undefined,
        website: data.website || undefined,
        notes: data.notes || undefined,
      })
      const updated = await getSuppliers()
      setSuppliers((updated as Supplier[]) ?? [])
      setShowForm(false)
      setEditing(null)
    })
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this supplier?')) return
    startTransition(async () => {
      await deleteSupplier(id)
      setSuppliers(prev => prev.filter(s => s.id !== id))
    })
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">{t.suppliers.title}</h1>
        <p className="text-muted-foreground mt-1">{t.suppliers.subtitle}</p>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600/30 transition-colors"
            placeholder={t.suppliers.searchSuppliers}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true) }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="size-4" /> {t.suppliers.addSupplier}
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <Truck className="size-8 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-sm text-muted-foreground">
            {t.suppliers.noSuppliers}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                {[t.common.name, t.suppliers.contactName, t.common.email, t.common.phone, t.common.city, 'Actions'].map(h => (
                  <th key={h} className={`px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide ${h === 'Actions' ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(s => (
                <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.contact_name ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.email ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.city ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => { setEditing(s); setShowForm(true) }}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors"
                      >
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
        <SupplierModal
          initial={editing}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditing(null) }}
          saving={isPending}
        />
      )}
    </div>
  )
}
