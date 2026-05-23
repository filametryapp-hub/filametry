'use client'

import { useState, useEffect, useTransition } from 'react'
import { Plus, Pencil, Trash2, Search, Users } from 'lucide-react'
import { getClients, upsertClient, deleteClient } from '@/lib/actions/clients'
import { useT } from '@/lib/i18n'

type Client = {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  document?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  notes?: string | null
}

const EMPTY: Omit<Client, 'id'> = { name: '', email: '', phone: '', document: '', address: '', city: '', state: '', country: 'US', notes: '' }

const INPUT = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600/30 transition-colors placeholder:text-muted-foreground'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
      {children}
    </div>
  )
}

function ClientModal({
  initial,
  onSave,
  onClose,
  saving,
}: {
  initial?: Client | null
  onSave: (data: Client) => void
  onClose: () => void
  saving: boolean
}) {
  const { t } = useT()
  const [form, setForm] = useState<Client>(initial ?? { id: '', ...EMPTY })
  const set = (k: keyof Client, v: string) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl space-y-5">
        <h2 className="font-semibold text-lg">{initial?.id ? t.clients.editClient : t.clients.addClient}</h2>

        <Field label={`${t.common.name} *`}>
          <input className={INPUT} value={form.name} onChange={e => set('name', e.target.value)} placeholder="John Doe" />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label={t.common.email}>
            <input className={INPUT} type="email" value={form.email ?? ''} onChange={e => set('email', e.target.value)} placeholder="john@example.com" />
          </Field>
          <Field label={t.common.phone}>
            <input className={INPUT} value={form.phone ?? ''} onChange={e => set('phone', e.target.value)} placeholder="+1 555 000 0000" />
          </Field>
        </div>

        <Field label={t.common.document}>
          <input className={INPUT} value={form.document ?? ''} onChange={e => set('document', e.target.value)} />
        </Field>

        <Field label={t.common.address}>
          <input className={INPUT} value={form.address ?? ''} onChange={e => set('address', e.target.value)} placeholder="123 Main St" />
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

export default function ClientsPage() {
  const { t } = useT()
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    getClients().then(data => setClients((data as Client[]) ?? []))
  }, [])

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email ?? '').toLowerCase().includes(search.toLowerCase())
  )

  function handleSave(data: Client) {
    startTransition(async () => {
      await upsertClient({
        id: data.id || undefined,
        name: data.name,
        email: data.email || undefined,
        phone: data.phone || undefined,
        document: data.document || undefined,
        address: data.address || undefined,
        city: data.city || undefined,
        state: data.state || undefined,
        country: data.country || undefined,
        notes: data.notes || undefined,
      })
      const updated = await getClients()
      setClients((updated as Client[]) ?? [])
      setShowForm(false)
      setEditing(null)
    })
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this client?')) return
    startTransition(async () => {
      await deleteClient(id)
      setClients(prev => prev.filter(c => c.id !== id))
    })
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">{t.clients.title}</h1>
        <p className="text-muted-foreground mt-1">{t.clients.subtitle}</p>
      </div>

      {/* Actions bar */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600/30 transition-colors"
            placeholder={t.clients.searchClients}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true) }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="size-4" /> {t.clients.addClient}
        </button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <Users className="size-8 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-sm text-muted-foreground">
            {t.clients.noClients}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                {[t.common.name, t.common.email, t.common.phone, t.common.city, 'Actions'].map(h => (
                  <th key={h} className={`px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide ${h === 'Actions' ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(client => (
                <tr key={client.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{client.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{client.email ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{client.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{client.city ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => { setEditing(client); setShowForm(true) }}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(client.id)}
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
        <ClientModal
          initial={editing}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditing(null) }}
          saving={isPending}
        />
      )}
    </div>
  )
}
