'use client'

import { useState, useEffect, useTransition } from 'react'
import { Building2, Users, Plus, Trash2, Save, CheckCircle2 } from 'lucide-react'
import {
  getCompany,
  updateCompany,
  getPartners,
  addPartner,
  removePartner,
} from '@/lib/actions/company'

type Company = {
  id: string
  name: string
  owner_name: string
  document?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  is_partnership?: boolean | null
}

type Partner = {
  id: string
  name: string
  email?: string | null
  percentage: number
}

const INPUT = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors placeholder:text-muted-foreground'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
      {children}
    </div>
  )
}

export default function SettingsPage() {
  const [, startTransition] = useTransition()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // Company form
  const [form, setForm] = useState<Omit<Company, 'id'>>({
    name: '', owner_name: '', document: '', phone: '', email: '',
    address: '', city: '', state: '', country: 'US', is_partnership: false,
  })

  // Partners
  const [partners, setPartners] = useState<Partner[]>([])
  const [newPartner, setNewPartner] = useState({ name: '', email: '', percentage: '' })
  const [addingPartner, setAddingPartner] = useState(false)
  const [partnerError, setPartnerError] = useState('')

  useEffect(() => {
    async function load() {
      const [company, plist] = await Promise.all([getCompany(), getPartners()])
      if (company) {
        setForm({
          name: company.name ?? '',
          owner_name: company.owner_name ?? '',
          document: company.document ?? '',
          phone: company.phone ?? '',
          email: company.email ?? '',
          address: company.address ?? '',
          city: company.city ?? '',
          state: company.state ?? '',
          country: company.country ?? 'US',
          is_partnership: company.is_partnership ?? false,
        })
      }
      setPartners(plist as Partner[])
      setLoading(false)
    }
    load()
  }, [])

  function set(k: keyof typeof form, v: string | boolean) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleSave() {
    if (!form.name.trim() || !form.owner_name.trim()) {
      setError('Company name and owner name are required.')
      return
    }
    setError('')
    setSaving(true)
    try {
      await updateCompany({
        name: form.name,
        owner_name: form.owner_name,
        document: form.document || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        address: form.address || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        country: form.country || undefined,
        is_partnership: form.is_partnership ?? false,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddPartner() {
    if (!newPartner.name.trim() || !newPartner.percentage) {
      setPartnerError('Name and percentage are required.')
      return
    }
    const pct = parseFloat(newPartner.percentage)
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      setPartnerError('Invalid percentage.')
      return
    }
    setPartnerError('')
    setAddingPartner(true)
    try {
      await addPartner({
        name: newPartner.name,
        email: newPartner.email || undefined,
        percentage: pct,
      })
      const updated = await getPartners()
      setPartners(updated as Partner[])
      setNewPartner({ name: '', email: '', percentage: '' })
    } catch (e) {
      setPartnerError(e instanceof Error ? e.message : 'Failed to add partner.')
    } finally {
      setAddingPartner(false)
    }
  }

  async function handleRemovePartner(id: string) {
    startTransition(async () => {
      await removePartner(id)
      setPartners(prev => prev.filter(p => p.id !== id))
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="size-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your company information and partners.</p>
      </div>

      {/* Company Info */}
      <section className="rounded-2xl border border-border bg-card p-6 space-y-5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-orange-500/10">
            <Building2 className="size-4 text-orange-500" />
          </div>
          <h2 className="font-semibold">Company Info</h2>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Company name *">
            <input className={INPUT} value={form.name} onChange={e => set('name', e.target.value)} />
          </Field>
          <Field label="Owner name *">
            <input className={INPUT} value={form.owner_name} onChange={e => set('owner_name', e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="CNPJ / EIN">
            <input className={INPUT} value={form.document ?? ''} onChange={e => set('document', e.target.value)} placeholder="Optional" />
          </Field>
          <Field label="Phone">
            <input className={INPUT} value={form.phone ?? ''} onChange={e => set('phone', e.target.value)} placeholder="+1 555 000 0000" />
          </Field>
        </div>

        <Field label="Business email">
          <input className={INPUT} type="email" value={form.email ?? ''} onChange={e => set('email', e.target.value)} placeholder="hello@company.com" />
        </Field>

        <Field label="Address">
          <input className={INPUT} value={form.address ?? ''} onChange={e => set('address', e.target.value)} placeholder="123 Main St" />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="City">
            <input className={INPUT} value={form.city ?? ''} onChange={e => set('city', e.target.value)} />
          </Field>
          <Field label="State">
            <input className={INPUT} value={form.state ?? ''} onChange={e => set('state', e.target.value)} />
          </Field>
          <Field label="Country">
            <input className={INPUT} value={form.country ?? ''} onChange={e => set('country', e.target.value)} />
          </Field>
        </div>

        <div className="flex items-center gap-3">
          <button
            role="switch"
            aria-checked={form.is_partnership ?? false}
            onClick={() => set('is_partnership', !form.is_partnership)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              form.is_partnership ? 'bg-orange-500' : 'bg-muted'
            }`}
          >
            <span className={`inline-block size-3.5 rounded-full bg-white shadow transition-transform ${
              form.is_partnership ? 'translate-x-4' : 'translate-x-0.5'
            }`} />
          </button>
          <span className="text-sm text-muted-foreground">This is a partnership business</span>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          {saved ? <CheckCircle2 className="size-4" /> : <Save className="size-4" />}
          {saved ? 'Saved!' : saving ? 'Saving…' : 'Save changes'}
        </button>
      </section>

      {/* Partners */}
      {form.is_partnership && (
        <section className="rounded-2xl border border-border bg-card p-6 space-y-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <Users className="size-4 text-orange-500" />
            </div>
            <h2 className="font-semibold">Partners</h2>
          </div>

          {partners.length > 0 && (
            <div className="rounded-xl border border-border divide-y divide-border">
              {partners.map(p => (
                <div key={p.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    {p.email && <p className="text-xs text-muted-foreground">{p.email}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono font-semibold text-orange-500">{p.percentage}%</span>
                    <button
                      onClick={() => handleRemovePartner(p.id)}
                      className="text-muted-foreground hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add new partner */}
          <div className="rounded-xl border border-dashed border-border p-4 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Add partner</p>
            <div className="grid grid-cols-2 gap-3">
              <input
                className={INPUT}
                placeholder="Full name *"
                value={newPartner.name}
                onChange={e => setNewPartner(p => ({ ...p, name: e.target.value }))}
              />
              <input
                className={INPUT}
                placeholder="Email (optional)"
                value={newPartner.email}
                onChange={e => setNewPartner(p => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div className="flex gap-3 items-end">
              <div className="w-32">
                <input
                  className={INPUT}
                  placeholder="% share"
                  type="number"
                  min="0"
                  max="100"
                  value={newPartner.percentage}
                  onChange={e => setNewPartner(p => ({ ...p, percentage: e.target.value }))}
                />
              </div>
              <button
                onClick={handleAddPartner}
                disabled={addingPartner}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                <Plus className="size-4" />
                {addingPartner ? 'Adding…' : 'Add'}
              </button>
            </div>
            {partnerError && <p className="text-sm text-red-400">{partnerError}</p>}
          </div>
        </section>
      )}
    </div>
  )
}
