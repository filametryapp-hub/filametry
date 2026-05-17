'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, CheckCircle2, Building2, Users, ArrowRight } from 'lucide-react'
import { createCompany, addPartner } from '@/lib/actions/company'

type Partner = { name: string; email: string; percentage: string }

const STEPS = [
  { label: 'Company Info', icon: Building2 },
  { label: 'Partnership', icon: Users },
  { label: 'Done', icon: CheckCircle2 },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Step 1 fields
  const [name, setName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [document, setDocument] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [country, setCountry] = useState('US')

  // Step 2 fields
  const [isPartnership, setIsPartnership] = useState<boolean | null>(null)
  const [partners, setPartners] = useState<Partner[]>([{ name: '', email: '', percentage: '' }])

  function addPartnerRow() {
    setPartners(prev => [...prev, { name: '', email: '', percentage: '' }])
  }

  function removePartnerRow(idx: number) {
    setPartners(prev => prev.filter((_, i) => i !== idx))
  }

  function updatePartner(idx: number, field: keyof Partner, value: string) {
    setPartners(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p))
  }

  function totalPct() {
    return partners.reduce((s, p) => s + (parseFloat(p.percentage) || 0), 0)
  }

  async function handleStep1() {
    if (!name.trim() || !ownerName.trim()) {
      setError('Company name and owner name are required.')
      return
    }
    setError('')
    setStep(1)
  }

  async function handleStep2() {
    if (isPartnership === null) {
      setError('Please choose an option.')
      return
    }
    if (isPartnership) {
      const total = totalPct()
      if (Math.abs(total - 100) > 0.01) {
        setError(`Partner percentages must total 100%. Currently: ${total}%`)
        return
      }
      const invalid = partners.some(p => !p.name.trim() || !p.percentage)
      if (invalid) {
        setError('All partners need a name and percentage.')
        return
      }
    }
    setError('')
    setLoading(true)
    try {
      const company = await createCompany({
        name,
        owner_name: ownerName,
        document: document || undefined,
        phone: phone || undefined,
        email: email || undefined,
        address: address || undefined,
        city: city || undefined,
        state: state || undefined,
        country,
        is_partnership: isPartnership,
      })

      if (isPartnership) {
        for (const p of partners) {
          await addPartner({
            name: p.name,
            email: p.email || undefined,
            percentage: parseFloat(p.percentage),
          })
        }
      }

      setStep(2)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            const active = i === step
            const done = i < step
            return (
              <div key={i} className="flex items-center gap-3">
                <div className="flex flex-col items-center gap-1">
                  <div className={`size-10 rounded-full flex items-center justify-center transition-colors ${
                    done ? 'bg-orange-500 text-white' :
                    active ? 'bg-orange-500/20 border-2 border-orange-500 text-orange-500' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    <Icon className="size-4" />
                  </div>
                  <span className={`text-xs font-medium ${active ? 'text-orange-500' : 'text-muted-foreground'}`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-12 h-0.5 mb-4 ${i < step ? 'bg-orange-500' : 'bg-border'}`} />
                )}
              </div>
            )
          })}
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          {/* Step 0: Company Info */}
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-bold">Set up your company</h1>
                <p className="text-sm text-muted-foreground mt-1">Tell us about your 3D printing business.</p>
              </div>

              <Field label="Company name *">
                <input className={INPUT} value={name} onChange={e => setName(e.target.value)} placeholder="Acme 3D Prints" />
              </Field>

              <Field label="Owner name *">
                <input className={INPUT} value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="Jane Smith" />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="CNPJ / EIN">
                  <input className={INPUT} value={document} onChange={e => setDocument(e.target.value)} placeholder="Optional" />
                </Field>
                <Field label="Phone">
                  <input className={INPUT} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 555 000 0000" />
                </Field>
              </div>

              <Field label="Business email">
                <input className={INPUT} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="hello@company.com" />
              </Field>

              <Field label="Address">
                <input className={INPUT} value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Main St" />
              </Field>

              <div className="grid grid-cols-3 gap-3">
                <Field label="City">
                  <input className={INPUT} value={city} onChange={e => setCity(e.target.value)} placeholder="Austin" />
                </Field>
                <Field label="State">
                  <input className={INPUT} value={state} onChange={e => setState(e.target.value)} placeholder="TX" />
                </Field>
                <Field label="Country">
                  <input className={INPUT} value={country} onChange={e => setCountry(e.target.value)} placeholder="US" />
                </Field>
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <button onClick={handleStep1} className={BTN}>
                Continue <ArrowRight className="size-4" />
              </button>
            </div>
          )}

          {/* Step 1: Partnership */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-bold">Is this a partnership?</h1>
                <p className="text-sm text-muted-foreground mt-1">Do you run this business with partners?</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: false, label: 'No, solo business' },
                  { value: true,  label: 'Yes, partnership' },
                ].map(opt => (
                  <button
                    key={String(opt.value)}
                    onClick={() => setIsPartnership(opt.value)}
                    className={`rounded-xl border p-4 text-sm font-medium transition-colors text-left ${
                      isPartnership === opt.value
                        ? 'border-orange-500 bg-orange-500/10 text-orange-500'
                        : 'border-border hover:border-orange-500/40'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {isPartnership && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Partners</p>
                    <span className={`text-xs font-mono ${Math.abs(totalPct() - 100) < 0.01 ? 'text-green-400' : 'text-orange-500'}`}>
                      {totalPct()}% / 100%
                    </span>
                  </div>
                  {partners.map((p, i) => (
                    <div key={i} className="rounded-lg border border-border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Partner {i + 1}</span>
                        {partners.length > 1 && (
                          <button onClick={() => removePartnerRow(i)} className="text-muted-foreground hover:text-red-400 transition-colors">
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                      <input
                        className={INPUT}
                        placeholder="Full name *"
                        value={p.name}
                        onChange={e => updatePartner(i, 'name', e.target.value)}
                      />
                      <div className="flex gap-2">
                        <input
                          className={`${INPUT} flex-1`}
                          placeholder="Email (optional)"
                          value={p.email}
                          onChange={e => updatePartner(i, 'email', e.target.value)}
                        />
                        <input
                          className={`${INPUT} w-24`}
                          placeholder="% share"
                          type="number"
                          min="0"
                          max="100"
                          value={p.percentage}
                          onChange={e => updatePartner(i, 'percentage', e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                  <button onClick={addPartnerRow} className="flex items-center gap-1.5 text-sm text-orange-500 hover:text-orange-600 transition-colors">
                    <Plus className="size-4" /> Add partner
                  </button>
                </div>
              )}

              {error && <p className="text-sm text-red-400">{error}</p>}

              <div className="flex gap-3">
                <button onClick={() => { setError(''); setStep(0) }} className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors">
                  Back
                </button>
                <button onClick={handleStep2} disabled={loading} className={`${BTN} flex-1`}>
                  {loading ? 'Saving…' : 'Finish setup'} {!loading && <ArrowRight className="size-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Done */}
          {step === 2 && (
            <div className="text-center space-y-5 py-4">
              <div className="size-16 rounded-full bg-orange-500/10 flex items-center justify-center mx-auto">
                <CheckCircle2 className="size-8 text-orange-500" />
              </div>
              <div>
                <h1 className="text-xl font-bold">You&apos;re all set!</h1>
                <p className="text-sm text-muted-foreground mt-1">Your company is ready. Start managing your 3D printing business.</p>
              </div>
              <button onClick={() => router.push('/dashboard')} className={BTN}>
                Go to Dashboard <ArrowRight className="size-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  )
}

const INPUT = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors placeholder:text-muted-foreground'
const BTN = 'w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50'
