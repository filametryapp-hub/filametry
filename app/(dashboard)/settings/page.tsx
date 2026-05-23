'use client'

import { useState, useEffect, useTransition } from 'react'
import { Building2, Users, Plus, Trash2, Save, CheckCircle2, DollarSign, Link2, Link2Off, Eye, EyeOff, Pencil, X, Check } from 'lucide-react'
import {
  getCompany,
  updateCompany,
  getPartners,
  addPartner,
  removePartner,
  updatePartner,
} from '@/lib/actions/company'
import {
  getBambuStatus,
  bambuConnect,
  bambuVerify,
  bambuTfa,
  bambuDisconnect,
} from '@/lib/actions/bambu'
import { useT, CURRENCIES, type CurrencyCode } from '@/lib/i18n'

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

const INPUT = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600/30 transition-colors placeholder:text-muted-foreground'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
      {children}
    </div>
  )
}

// ── Bambu Lab integration card ────────────────────────────────
function BambuSection() {
  const [status, setStatus]           = useState<{ connected: boolean; email: string | null } | null>(null)
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [showPass, setShowPass]       = useState(false)
  const [step, setStep]               = useState<'idle' | 'verify' | 'tfa'>('idle')
  const [tfaKey, setTfaKey]           = useState('')
  const [busy, setBusy]               = useState(false)
  const [verifyCode, setVerifyCode]   = useState('')
  const [error, setError]             = useState('')

  useEffect(() => {
    getBambuStatus().then(setStatus).catch(() => setStatus({ connected: false, email: null }))
  }, [])

  async function handleConnect() {
    if (!email.trim() || !password.trim()) { setError('Email e senha são obrigatórios.'); return }
    setError('')
    setBusy(true)
    const result = await bambuConnect(email.trim(), password)
    setBusy(false)
    if (result.type === 'ok') {
      setStatus({ connected: true, email: email.trim() })
      setPassword('')
    } else if (result.type === 'verify') {
      setStep('verify')
    } else if (result.type === 'tfa') {
      setTfaKey(result.tfaKey)
      setStep('tfa')
    } else {
      setError(result.msg)
    }
  }

  async function handleVerify() {
    if (!verifyCode.trim()) { setError('Digite o código.'); return }
    setError('')
    setBusy(true)
    const result = await bambuVerify(email.trim(), verifyCode.trim())
    setBusy(false)
    if (result.type === 'ok') {
      setStatus({ connected: true, email: email.trim() })
      setVerifyCode('')
      setPassword('')
      setStep('idle')
    } else {
      setError(result.msg)
    }
  }

  async function handleTfa() {
    if (!verifyCode.trim()) { setError('Digite o código TOTP.'); return }
    setError('')
    setBusy(true)
    const result = await bambuTfa(tfaKey, verifyCode.trim())
    setBusy(false)
    if (result.type === 'ok') {
      setStatus({ connected: true, email: email.trim() })
      setVerifyCode('')
      setPassword('')
      setStep('idle')
    } else {
      setError(result.msg)
    }
  }

  async function handleDisconnect() {
    await bambuDisconnect()
    setStatus({ connected: false, email: null })
    setEmail('')
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-lg bg-green-500/10">
          <svg className="size-4" viewBox="0 0 24 24" fill="none" aria-label="Bambu Lab">
            <path d="M12 2L4 6v12l8 4 8-4V6L12 2z" fill="#00AE42" opacity=".9" />
            <path d="M12 2v20M4 6l8 4 8-4" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </div>
        <div>
          <h2 className="font-semibold">Bambu Lab</h2>
          <p className="text-xs text-muted-foreground">Importe o histórico de impressões direto do Bambu Cloud</p>
        </div>
        {status?.connected && (
          <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-green-400 animate-pulse" />
            Conectado
          </span>
        )}
      </div>

      {status === null ? (
        <div className="h-8 flex items-center">
          <div className="size-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : status.connected ? (
        /* ── Connected state ── */
        <div className="flex items-center justify-between rounded-xl border border-green-500/20 bg-green-500/5 px-4 py-3">
          <div>
            <p className="text-sm font-medium">{status.email}</p>
            <p className="text-xs text-muted-foreground">Conta Bambu Lab conectada</p>
          </div>
          <button
            onClick={handleDisconnect}
            className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-500 transition-colors"
          >
            <Link2Off className="size-3.5" />
            Desconectar
          </button>
        </div>
      ) : step === 'verify' ? (
        /* ── Email verification code ── */
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Um código de verificação foi enviado para <span className="font-medium text-foreground">{email}</span>. Verifique sua caixa de entrada e cole o código abaixo.
          </p>
          <input
            className={INPUT}
            placeholder="Código de 6 dígitos"
            value={verifyCode}
            maxLength={8}
            inputMode="numeric"
            onChange={e => setVerifyCode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleVerify()}
            autoFocus
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => { setStep('idle'); setError(''); setVerifyCode('') }}
              className="text-sm px-3 py-2 rounded-lg border border-border hover:bg-muted transition-colors">
              Voltar
            </button>
            <button onClick={handleVerify} disabled={busy}
              className="flex-1 flex items-center justify-center gap-2 text-sm bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg transition-colors">
              {busy
                ? <><div className="size-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Verificando…</>
                : <>Verificar código</>}
            </button>
          </div>
        </div>
      ) : step === 'tfa' ? (
        /* ── TOTP / Authenticator app ── */
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Sua conta usa autenticação de dois fatores. Digite o código do seu aplicativo autenticador.
          </p>
          <input
            className={INPUT}
            placeholder="Código TOTP (6 dígitos)"
            value={verifyCode}
            maxLength={6}
            inputMode="numeric"
            onChange={e => setVerifyCode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleTfa()}
            autoFocus
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => { setStep('idle'); setError(''); setVerifyCode('') }}
              className="text-sm px-3 py-2 rounded-lg border border-border hover:bg-muted transition-colors">
              Voltar
            </button>
            <button onClick={handleTfa} disabled={busy}
              className="flex-1 flex items-center justify-center gap-2 text-sm bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg transition-colors">
              {busy
                ? <><div className="size-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Verificando…</>
                : <>Confirmar 2FA</>}
            </button>
          </div>
        </div>
      ) : (
        /* ── Login form ── */
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              className={INPUT}
              type="email"
              placeholder="Email da conta Bambu Lab"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
            <div className="relative">
              <input
                className={INPUT + ' pr-10'}
                type={showPass ? 'text' : 'password'}
                placeholder="Senha"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleConnect()}
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            onClick={handleConnect}
            disabled={busy}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            {busy
              ? <><div className="size-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Conectando…</>
              : <><Link2 className="size-4" /> Conectar Bambu Lab</>}
          </button>
          <p className="text-xs text-muted-foreground">
            Suas credenciais são usadas apenas para obter um token de acesso que fica armazenado de forma segura.
          </p>
        </div>
      )}
    </section>
  )
}

export default function SettingsPage() {
  const { t, currency, setCurrency } = useT()
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
  const [editPartnerId, setEditPartnerId] = useState<string | null>(null)
  const [editPartnerForm, setEditPartnerForm] = useState({ name: '', email: '', percentage: '' })

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

  function startEditPartner(p: Partner) {
    setEditPartnerId(p.id)
    setEditPartnerForm({ name: p.name, email: p.email ?? '', percentage: String(p.percentage) })
  }

  async function handleUpdatePartner(id: string) {
    const pct = parseFloat(editPartnerForm.percentage)
    if (!editPartnerForm.name.trim() || isNaN(pct)) return
    startTransition(async () => {
      await updatePartner(id, {
        name:       editPartnerForm.name.trim(),
        email:      editPartnerForm.email.trim() || undefined,
        percentage: pct,
      })
      setPartners(prev => prev.map(p =>
        p.id === id ? { ...p, name: editPartnerForm.name.trim(), email: editPartnerForm.email.trim() || null, percentage: pct } : p
      ))
      setEditPartnerId(null)
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="size-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your company information and partners.</p>
      </div>

      {/* Preferences */}
      <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-blue-600/10">
            <DollarSign className="size-4 text-blue-600" />
          </div>
          <div>
            <h2 className="font-semibold">{t.settings.preferences}</h2>
            <p className="text-xs text-muted-foreground">{t.settings.currencyDesc}</p>
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t.settings.currency}</label>
          <div className="flex flex-wrap gap-2">
            {CURRENCIES.map(c => (
              <button
                key={c.code}
                onClick={() => setCurrency(c.code as CurrencyCode)}
                className={`text-sm px-4 py-1.5 rounded-full border transition-colors ${
                  currency === c.code
                    ? 'border-blue-600 bg-blue-600/10 text-blue-600 font-medium'
                    : 'border-border text-muted-foreground hover:border-blue-600/40'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Company Info */}
      <section className="rounded-2xl border border-border bg-card p-6 space-y-5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-blue-600/10">
            <Building2 className="size-4 text-blue-600" />
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
          <Field label={t.common.document}>
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
              form.is_partnership ? 'bg-blue-600' : 'bg-muted'
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
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          {saved ? <CheckCircle2 className="size-4" /> : <Save className="size-4" />}
          {saved ? 'Saved!' : saving ? 'Saving…' : 'Save changes'}
        </button>
      </section>

      {/* Bambu Lab */}
      <BambuSection />

      {/* Partners */}
      {form.is_partnership && (
        <section className="rounded-2xl border border-border bg-card p-6 space-y-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-600/10">
              <Users className="size-4 text-blue-600" />
            </div>
            <h2 className="font-semibold">Partners</h2>
          </div>

          {partners.length > 0 && (
            <div className="rounded-xl border border-border divide-y divide-border">
              {partners.map(p => (
                <div key={p.id}>
                  {editPartnerId === p.id ? (
                    /* ── Edit mode ── */
                    <div className="px-4 py-3 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          className={INPUT}
                          value={editPartnerForm.name}
                          onChange={e => setEditPartnerForm(f => ({ ...f, name: e.target.value }))}
                          placeholder="Full name *"
                          autoFocus
                        />
                        <input
                          className={INPUT}
                          value={editPartnerForm.email}
                          onChange={e => setEditPartnerForm(f => ({ ...f, email: e.target.value }))}
                          placeholder="Email (optional)"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          className={INPUT + ' w-28'}
                          value={editPartnerForm.percentage}
                          onChange={e => setEditPartnerForm(f => ({ ...f, percentage: e.target.value }))}
                          placeholder="% share"
                          type="number" min="0" max="100"
                        />
                        <button
                          onClick={() => handleUpdatePartner(p.id)}
                          className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors font-medium"
                        >
                          <Check className="size-3.5" /> Save
                        </button>
                        <button
                          onClick={() => setEditPartnerId(null)}
                          className="flex items-center gap-1.5 text-xs border border-border px-3 py-1.5 rounded-lg hover:bg-muted transition-colors"
                        >
                          <X className="size-3.5" /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ── View mode ── */
                    <div className="flex items-center justify-between px-4 py-3 group">
                      <div>
                        <p className="text-sm font-medium">{p.name}</p>
                        {p.email && <p className="text-xs text-muted-foreground">{p.email}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono font-semibold text-blue-600">{p.percentage}%</span>
                        <button
                          onClick={() => startEditPartner(p)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          onClick={() => handleRemovePartner(p.id)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
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
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
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
