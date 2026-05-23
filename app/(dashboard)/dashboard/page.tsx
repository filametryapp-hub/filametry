'use client'

import { useEffect, useState } from 'react'
import { Calculator, Layers, Package, ClipboardList, Printer, TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import Link from 'next/link'
import { getProfile } from '@/lib/actions/billing'
import { getPrinterCount } from '@/lib/actions/printers'
import { TRIAL_PRINTER_LIMIT } from '@/lib/stripe/plans'
import { getCashFlowSummary } from '@/lib/actions/cash-flow'
import { useT } from '@/lib/i18n'

function fmtCurrency(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

type CashSummary = { income: number; expenses: number; balance: number }

export default function DashboardPage() {
  const { t } = useT()
  const [loading, setLoading] = useState(true)
  const [printerCount, setPrinterCount] = useState(0)
  const [printerLimit, setPrinterLimit] = useState(TRIAL_PRINTER_LIMIT)
  const [cashSummary, setCashSummary] = useState<CashSummary>({ income: 0, expenses: 0, balance: 0 })

  useEffect(() => {
    async function load() {
      try {
        const [profile, count, cash] = await Promise.all([
          getProfile(),
          getPrinterCount(),
          getCashFlowSummary().catch(() => ({ income: 0, expenses: 0, balance: 0 })),
        ])
        setPrinterLimit(profile?.printer_limit ?? TRIAL_PRINTER_LIMIT)
        setPrinterCount(count)
        setCashSummary(cash)
      } catch {
        // silently fail — defaults remain
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const displayLimit = printerLimit === 9999 ? '∞' : String(printerLimit)
  const pct = printerLimit === 9999 ? 0 : Math.min(100, Math.round((printerCount / printerLimit) * 100))
  const positive = cashSummary.balance >= 0

  const CARDS = [
    {
      href: '/precificacao',
      icon: Calculator,
      title: t.dashboard.pricing,
      description: t.dashboard.pricingDesc,
      color: 'text-blue-600',
      bg: 'bg-blue-600/10',
    },
    {
      href: '/filamentos',
      icon: Layers,
      title: t.dashboard.materials,
      description: t.dashboard.materialsDesc,
      color: 'text-blue-400',
      bg: 'bg-blue-400/10',
    },
    {
      href: '/produtos',
      icon: Package,
      title: t.dashboard.products,
      description: t.dashboard.productsDesc,
      color: 'text-green-400',
      bg: 'bg-green-400/10',
    },
    {
      href: '/pedidos',
      icon: ClipboardList,
      title: t.dashboard.orders,
      description: t.dashboard.ordersDesc,
      color: 'text-purple-400',
      bg: 'bg-purple-400/10',
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="size-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">{t.dashboard.title}</h1>
        <p className="text-muted-foreground mt-1">{t.dashboard.subtitle}</p>
      </div>

      {/* Monthly financial summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Link href="/cash-flow" className="rounded-xl border border-border bg-card p-5 hover:border-blue-600/40 transition-colors group">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="size-4 text-green-400" />
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{t.dashboard.revenue}</p>
          </div>
          <p className="text-xl font-bold text-green-400 group-hover:text-green-300 transition-colors">{fmtCurrency(cashSummary.income)}</p>
        </Link>
        <Link href="/expenses" className="rounded-xl border border-border bg-card p-5 hover:border-blue-600/40 transition-colors group">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="size-4 text-red-400" />
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{t.dashboard.expenses}</p>
          </div>
          <p className="text-xl font-bold text-red-400 group-hover:text-red-300 transition-colors">{fmtCurrency(cashSummary.expenses)}</p>
        </Link>
        <Link href="/cash-flow" className="rounded-xl border border-border bg-card p-5 hover:border-blue-600/40 transition-colors group">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="size-4" style={{ color: positive ? '#FF6B35' : '#f87171' }} />
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{t.dashboard.balance}</p>
          </div>
          <p className="text-xl font-bold transition-colors" style={{ color: positive ? '#FF6B35' : '#f87171' }}>{fmtCurrency(cashSummary.balance)}</p>
        </Link>
      </div>

      {/* Printer usage widget */}
      <Link
        href="/printers"
        className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 mb-6 hover:border-blue-600/40 transition-colors group"
      >
        <div className="p-2.5 rounded-lg bg-blue-600/10">
          <Printer className="size-5 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-sm font-medium group-hover:text-blue-600 transition-colors">
              {t.dashboard.registeredPrinters}
            </p>
            <span className="text-sm font-semibold tabular-nums">
              {printerCount} / {displayLimit}
            </span>
          </div>
          {printerLimit !== 9999 && (
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-blue-500' : 'bg-blue-600'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </div>
      </Link>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CARDS.map(({ href, icon: Icon, title, description, color, bg }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-xl border border-border bg-card p-6 hover:border-blue-600/40 transition-colors"
          >
            <div className={`inline-flex p-2.5 rounded-lg ${bg} mb-4`}>
              <Icon className={`size-5 ${color}`} />
            </div>
            <h2 className="font-semibold mb-1 group-hover:text-blue-600 transition-colors">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
