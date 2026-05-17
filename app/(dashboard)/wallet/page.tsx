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
} from '@/lib/actions/wallet'
import { getPartners } from '@/lib/actions/company'

const INPUT = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors placeholder:text-muted-foreground'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
}

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

export default function WalletPage() {
  const { t } = useT()
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
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const [plist, inv, dist, sum] = await Promise.all([
          getPartners(),
          getPartnerInvestments().catch(() => []),
          getDistributions().catch(() => []),
          getCompanyWalletSummary().catch(() => ({
            totalRevenue: 0, totalExpenses: 0, netBalance: 0,
            totalDistributed: 0, distributable: 0, avgMonthlyRevenue: 0,
          })),
        ])
        setPartners((plist ?? []) as Partner[])
        setInvestments(inv as Investment[])
        setDistributions(dist as Distribution[])
        setSummary(sum)
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
      setFormError('Partner and amount are required.')
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
      setFormError(e instanceof Error ? e.message : 'Failed to add distribution.')
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
        <h1 className="text-2xl font-bold">{t.nav.wallet}</h1>
        <p className="text-muted-foreground mt-1">Track partner investments, distributions, and recovery projections.</p>
      </div>

      {/* Company Wallet Summary — 4 stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card px-5 py-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="size-3.5 text-green-400" />
            <p className="text-xs text-muted-foreground">Total Revenue</p>
          </div>
          <p className="text-lg font-bold text-green-400">{fmt(summary.totalRevenue)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-5 py-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="size-3.5 text-red-400" />
            <p className="text-xs text-muted-foreground">Total Expenses</p>
          </div>
          <p className="text-lg font-bold text-red-400">{fmt(summary.totalExpenses)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-5 py-4">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="size-3.5 text-orange-500" />
            <p className="text-xs text-muted-foreground">Net Balance</p>
          </div>
          <p className={`text-lg font-bold ${summary.netBalance >= 0 ? 'text-orange-500' : 'text-red-400'}`}>
            {fmt(summary.netBalance)}
          </p>
        </div>
        <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 px-5 py-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="size-3.5 text-orange-400" />
            <p className="text-xs text-orange-400/80">Available to Distribute</p>
          </div>
          <p className={`text-lg font-bold ${summary.distributable >= 0 ? 'text-orange-500' : 'text-red-400'}`}>
            {fmt(summary.distributable)}
          </p>
        </div>
      </div>

      {/* Partner Balances */}
      {partners.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Partner Balances</h2>
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
                      <p className="text-xs text-muted-foreground">{partner.percentage}% share</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${companyOwes ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                      {companyOwes ? 'Company owes' : 'Recovered'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-muted/40 p-2">
                      <p className="text-xs text-muted-foreground mb-0.5">Invested</p>
                      <p className="text-sm font-semibold font-mono">{fmt(totalInvested)}</p>
                    </div>
                    <div className="rounded-lg bg-muted/40 p-2">
                      <p className="text-xs text-muted-foreground mb-0.5">Received</p>
                      <p className="text-sm font-semibold font-mono">{fmt(totalReceived)}</p>
                    </div>
                    <div className={`rounded-lg p-2 ${companyOwes ? 'bg-red-500/10' : 'bg-green-500/10'}`}>
                      <p className={`text-xs mb-0.5 ${companyOwes ? 'text-red-400/80' : 'text-green-400/80'}`}>Balance</p>
                      <p className={`text-sm font-semibold font-mono ${companyOwes ? 'text-red-400' : 'text-green-400'}`}>
                        {companyOwes ? fmt(balance) : `-${fmt(Math.abs(balance))}`}
                      </p>
                    </div>
                  </div>
                  {months !== null && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="size-3" />
                      <span>Est. recovery: <span className="font-medium text-foreground">{months} month{months !== 1 ? 's' : ''}</span> at current avg revenue</span>
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
          <h2 className="font-semibold text-sm">Record Distribution</h2>
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
              placeholder="Partner name"
              value={distForm.partner_name}
              onChange={e => setDistForm(f => ({ ...f, partner_name: e.target.value }))}
            />
          )}
          <input
            className={INPUT}
            type="number"
            placeholder="Amount ($)"
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
            placeholder="Notes (optional)"
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
          {saving ? 'Saving…' : 'Add Distribution'}
        </button>
      </div>

      {/* Distribution History */}
      {distributions.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Distribution History</h2>
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
                  <span className="text-sm font-semibold font-mono text-orange-500">{fmt(Number(dist.amount))}</span>
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
              Total distributed: <span className="font-semibold text-foreground">{fmt(summary.totalDistributed)}</span>
            </p>
          </div>
        </div>
      )}

      {/* Recovery Projection */}
      {summary.avgMonthlyRevenue > 0 && investments.length > 0 && (
        <div className="rounded-xl border border-border bg-card px-5 py-4 space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-orange-500" />
            <h2 className="font-semibold text-sm">Recovery Projection</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Based on avg monthly revenue of <span className="font-medium text-foreground">{fmt(summary.avgMonthlyRevenue)}</span> (last 3 months).
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
                      ~<span className="font-semibold text-foreground">{months} month{months !== 1 ? 's' : ''}</span> to recover {fmt(balance)}
                    </span>
                  ) : (
                    <span className="text-green-400 text-xs font-medium">Investment recovered</span>
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
