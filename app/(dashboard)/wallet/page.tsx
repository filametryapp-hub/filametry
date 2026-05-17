'use client'

import { useEffect, useState } from 'react'
import { Wallet, TrendingUp, TrendingDown, DollarSign, Plus, Trash2, Clock } from 'lucide-react'
import { useT } from '@/lib/i18n'
import {
  getPartnerInvestments,
  getDistributions,
  addDistribution,
  deleteDistribution,
  getCompanyWalletSummary,
  getAssetDebtSummary,
} from '@/lib/actions/wallet'
import { getPartners } from '@/lib/actions/company'

const INPUT = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors placeholder:text-muted-foreground'

type Partner = { id: string; name: string; percentage: number }
type Investment = {
  name: string
  equipment: number
  materials: number
  total: number
  entries: { label: string; amount: number; date: string }[]
}
type Distribution = {
  id: string
  partner_name: string
  amount: number
  distributed_at: string
  notes?: string | null
}
type WalletSummary = {
  totalRevenue: number
  totalExpenses: number
  netBalance: number
  totalDistributed: number
  distributable: number
  avgMonthlyRevenue: number
}
type AssetDebt = {
  totalAssets: number
  partners: { name: string; percentage: number; expectedShare: number; actualPaid: number; balance: number }[]
}

export default function WalletPage() {
  const { t, fmtCurrency } = useT()
  const w = t.wallet
  const [loading, setLoading] = useState(true)
  const [partners, setPartners] = useState<Partner[]>([])
  const [investments, setInvestments] = useState<Investment[]>([])
  const [distributions, setDistributions] = useState<Distribution[]>([])
  const [summary, setSummary] = useState<WalletSummary>({
    totalRevenue: 0, totalExpenses: 0, netBalance: 0,
    totalDistributed: 0, distributable: 0, avgMonthlyRevenue: 0,
  })

  // Distribution form state
  const [distForm, setDistForm] = useState({
    partner_name: '',
    amount: '',
    distributed_at: new Date().toISOString().slice(0, 10),
    notes: '',
  })
  const [assetDebt, setAssetDebt] = useState<AssetDebt>({ totalAssets: 0, partners: [] })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const [plist, inv, dist, sum, debt] = await Promise.all([
          getPartners(),
          getPartnerInvestments().catch(() => []),
          getDistributions().catch(() => []),
          getCompanyWalletSummary().catch(() => ({
            totalRevenue: 0, totalExpenses: 0, netBalance: 0,
            totalDistributed: 0, distributable: 0, avgMonthlyRevenue: 0,
          })),
          getAssetDebtSummary().catch(() => ({ totalAssets: 0, partners: [] })),
        ])
        setPartners((plist ?? []) as Partner[])
        setInvestments(inv as Investment[])
        setDistributions(dist as Distribution[])
        setSummary(sum)
        setAssetDebt(debt as AssetDebt)
        if (plist && plist.length > 0) {
          setDistForm(f => ({ ...f, partner_name: (plist[0] as Partner).name }))
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleAddDistribution() {
    if (!distForm.partner_name || !distForm.amount) {
      setFormError(w.partnerAndAmountRequired)
      return
    }
    setSaving(true)
    setFormError('')
    try {
      await addDistribution({
        partner_name: distForm.partner_name,
        amount: parseFloat(distForm.amount),
        distributed_at: distForm.distributed_at,
        notes: distForm.notes || undefined,
      })
      // Refresh distributions and summary
      const [dist, sum] = await Promise.all([
        getDistributions().catch(() => []),
        getCompanyWalletSummary().catch(() => summary),
      ])
      setDistributions(dist as Distribution[])
      setSummary(sum)
      setDistForm(f => ({ ...f, amount: '', notes: '' }))
    } catch (e) {
      setFormError(e instanceof Error ? e.message : w.failedToAdd)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteDistribution(id: string) {
    try {
      await deleteDistribution(id)
      setDistributions(prev => prev.filter(d => d.id !== id))
      const sum = await getCompanyWalletSummary().catch(() => summary)
      setSummary(sum)
    } catch {
      // silently fail
    }
  }

  // Build per-partner balance: invested - received
  function getPartnerBalance(partnerName: string) {
    const inv = investments.find(i => i.name === partnerName)
    const totalInvested = inv?.total ?? 0
    const totalReceived = distributions
      .filter(d => d.partner_name === partnerName)
      .reduce((s, d) => s + Number(d.amount), 0)
    return { totalInvested, totalReceived, balance: totalInvested - totalReceived }
  }

  function recoveryMonths(balance: number) {
    if (summary.avgMonthlyRevenue <= 0 || balance <= 0) return null
    return Math.ceil(balance / summary.avgMonthlyRevenue)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="size-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{w.title}</h1>
        <p className="text-muted-foreground mt-1">{w.subtitle}</p>
      </div>

      {/* Company Wallet Summary — 4 stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card px-5 py-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="size-3.5 text-green-400" />
            <p className="text-xs text-muted-foreground">{w.totalRevenue}</p>
          </div>
          <p className="text-lg font-bold text-green-400">{fmtCurrency(summary.totalRevenue)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-5 py-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="size-3.5 text-red-400" />
            <p className="text-xs text-muted-foreground">{w.totalExpenses}</p>
          </div>
          <p className="text-lg font-bold text-red-400">{fmtCurrency(summary.totalExpenses)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-5 py-4">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="size-3.5 text-orange-500" />
            <p className="text-xs text-muted-foreground">{w.netBalance}</p>
          </div>
          <p className={`text-lg font-bold ${summary.netBalance >= 0 ? 'text-orange-500' : 'text-red-400'}`}>
            {fmtCurrency(summary.netBalance)}
          </p>
        </div>
        <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 px-5 py-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="size-3.5 text-orange-400" />
            <p className="text-xs text-orange-400/80">{w.distributable}</p>
          </div>
          <p className={`text-lg font-bold ${summary.distributable >= 0 ? 'text-orange-500' : 'text-red-400'}`}>
            {fmtCurrency(summary.distributable)}
          </p>
        </div>
      </div>

      {/* Asset Investment Debts */}
      {assetDebt.partners.length > 0 && assetDebt.totalAssets > 0 && (
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{w.assetDebts}</h2>
              <span className="text-xs text-muted-foreground">
                {w.totalAssets}: <span className="font-semibold text-foreground">{fmtCurrency(assetDebt.totalAssets)}</span>
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{w.assetDebtsSubtitle}</p>
          </div>
          <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
            {assetDebt.partners.map(partner => {
              const owes    = partner.balance < -0.01   // paid less → owes others
              const isOwed  = partner.balance > 0.01    // paid more → others owe them
              const settled = !owes && !isOwed
              return (
                <div key={partner.name} className="px-5 py-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">{partner.name}</p>
                      <p className="text-xs text-muted-foreground">{partner.percentage}% {w.share}</p>
                    </div>
                    {settled ? (
                      <span className="text-xs bg-green-500/10 text-green-400 px-2.5 py-0.5 rounded-full font-medium">{w.settledUp}</span>
                    ) : owes ? (
                      <span className="text-xs bg-red-500/10 text-red-400 px-2.5 py-0.5 rounded-full font-medium">
                        {w.partnerOwes} {fmtCurrency(Math.abs(partner.balance))}
                      </span>
                    ) : (
                      <span className="text-xs bg-blue-500/10 text-blue-400 px-2.5 py-0.5 rounded-full font-medium">
                        {w.partnerIsOwed} {fmtCurrency(partner.balance)}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-muted/40 px-3 py-2">
                      <p className="text-xs text-muted-foreground">{w.expectedShare}</p>
                      <p className="text-sm font-mono font-semibold">{fmtCurrency(partner.expectedShare)}</p>
                    </div>
                    <div className="rounded-lg bg-muted/40 px-3 py-2">
                      <p className="text-xs text-muted-foreground">{w.actualPaid}</p>
                      <p className="text-sm font-mono font-semibold">{fmtCurrency(partner.actualPaid)}</p>
                    </div>
                    <div className={`rounded-lg px-3 py-2 ${owes ? 'bg-red-500/10' : isOwed ? 'bg-blue-500/10' : 'bg-green-500/10'}`}>
                      <p className={`text-xs ${owes ? 'text-red-400/80' : isOwed ? 'text-blue-400/80' : 'text-green-400/80'}`}>{w.difference}</p>
                      <p className={`text-sm font-mono font-semibold ${owes ? 'text-red-400' : isOwed ? 'text-blue-400' : 'text-green-400'}`}>
                        {isOwed ? '+' : ''}{fmtCurrency(partner.balance)}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Partner Balances */}
      {partners.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{w.partnerBalances}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {partners.map(partner => {
              const { totalInvested, totalReceived, balance } = getPartnerBalance(partner.name)
              const companyOwes = balance > 0 // partner invested more than received
              const months = recoveryMonths(balance)
              return (
                <div key={partner.id} className={`rounded-xl border bg-card px-5 py-4 space-y-3 ${companyOwes ? 'border-red-500/30' : 'border-green-500/30'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">{partner.name}</p>
                      <p className="text-xs text-muted-foreground">{partner.percentage}% {w.share}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${companyOwes ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                      {companyOwes ? w.owes : w.recovered}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-muted/40 p-2">
                      <p className="text-xs text-muted-foreground mb-0.5">{w.invested}</p>
                      <p className="text-sm font-semibold font-mono">{fmtCurrency(totalInvested)}</p>
                    </div>
                    <div className="rounded-lg bg-muted/40 p-2">
                      <p className="text-xs text-muted-foreground mb-0.5">{w.received}</p>
                      <p className="text-sm font-semibold font-mono">{fmtCurrency(totalReceived)}</p>
                    </div>
                    <div className={`rounded-lg p-2 ${companyOwes ? 'bg-red-500/10' : 'bg-green-500/10'}`}>
                      <p className={`text-xs mb-0.5 ${companyOwes ? 'text-red-400/80' : 'text-green-400/80'}`}>{w.balance}</p>
                      <p className={`text-sm font-semibold font-mono ${companyOwes ? 'text-red-400' : 'text-green-400'}`}>
                        {companyOwes ? fmtCurrency(balance) : `-${fmtCurrency(Math.abs(balance))}`}
                      </p>
                    </div>
                  </div>
                  {months !== null && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="size-3" />
                      <span>{w.estRecovery} <span className="font-medium text-foreground">{months} {months !== 1 ? w.monthsToRecover : w.monthsToRecover.replace('meses', 'mês')}</span> {w.atCurrentRevenue}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Quick Distribution Form */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Plus className="size-4 text-orange-500" />
          <h2 className="font-semibold text-sm">{w.addDistribution}</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {partners.length > 0 ? (
            <select
              className={INPUT}
              value={distForm.partner_name}
              onChange={e => setDistForm(f => ({ ...f, partner_name: e.target.value }))}
            >
              {partners.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
          ) : (
            <input
              className={INPUT}
              placeholder={w.partnerName}
              value={distForm.partner_name}
              onChange={e => setDistForm(f => ({ ...f, partner_name: e.target.value }))}
            />
          )}
          <input
            className={INPUT}
            type="number"
            placeholder={w.amount}
            min="0"
            step="0.01"
            value={distForm.amount}
            onChange={e => setDistForm(f => ({ ...f, amount: e.target.value }))}
          />
          <input
            className={INPUT}
            type="date"
            value={distForm.distributed_at}
            onChange={e => setDistForm(f => ({ ...f, distributed_at: e.target.value }))}
          />
          <input
            className={INPUT}
            placeholder={w.notesOptional}
            value={distForm.notes}
            onChange={e => setDistForm(f => ({ ...f, notes: e.target.value }))}
          />
        </div>
        {formError && <p className="text-xs text-red-400">{formError}</p>}
        <button
          onClick={handleAddDistribution}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium transition-colors"
        >
          {saving ? t.common.saving : w.addDistribution}
        </button>
      </div>

      {/* Distribution History */}
      {distributions.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{w.distributions}</h2>
          <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
            {distributions.map(dist => (
              <div key={dist.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-4">
                  <div className="size-2 rounded-full bg-orange-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{dist.partner_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {dist.distributed_at}
                      {dist.notes && <span className="ml-2 italic">{dist.notes}</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-semibold font-mono text-orange-500">{fmtCurrency(Number(dist.amount))}</span>
                  <button
                    onClick={() => handleDeleteDistribution(dist.id)}
                    className="p-1 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <p className="text-xs text-muted-foreground">
              {w.totalDistributed}: <span className="font-semibold text-foreground">{fmtCurrency(summary.totalDistributed)}</span>
            </p>
          </div>
        </div>
      )}

      {/* Recovery Projection */}
      {summary.avgMonthlyRevenue > 0 && investments.length > 0 && (
        <div className="rounded-xl border border-border bg-card px-5 py-4 space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-orange-500" />
            <h2 className="font-semibold text-sm">{w.recoveryProjection}</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            {w.basedOnAvg} <span className="font-medium text-foreground">{fmtCurrency(summary.avgMonthlyRevenue)}</span> {w.lastThreeMonths}
          </p>
          <div className="space-y-2">
            {partners.map(partner => {
              const { balance } = getPartnerBalance(partner.name)
              const months = recoveryMonths(balance)
              return (
                <div key={partner.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{partner.name}</span>
                  {months !== null ? (
                    <span className="text-muted-foreground">
                      ~<span className="font-semibold text-foreground">{months} {w.monthsToRecover}</span> {fmtCurrency(balance)}
                    </span>
                  ) : (
                    <span className="text-green-400 text-xs font-medium">{w.alreadyRecovered}</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
