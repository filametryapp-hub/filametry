'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, ArrowUpRight, TrendingUp, TrendingDown } from 'lucide-react'
import { getDashboardData, type DashboardData } from '@/lib/actions/dashboard'
import { useT } from '@/lib/i18n'
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/product-types'

// ── Helpers ──────────────────────────────────────────────────────

function fmtWeight(kg: number) {
  if (kg >= 1) return `${kg.toFixed(1)} kg`
  return `${Math.round(kg * 1000)} g`
}

function fmtShort(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

// ── Skeleton ─────────────────────────────────────────────────────
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className}`} />
}

// ── KPI Card ─────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, trend, href,
}: {
  label: string
  value: string
  sub?: string
  trend?: { value: string; positive: boolean }
  href?: string
}) {
  const inner = (
    <div className="rounded-xl border border-border bg-card px-5 py-4 hover:border-[#2f5fff]/30 transition-colors h-full">
      <p className="text-xs text-muted-foreground mb-3">{label}</p>
      <p className="text-[22px] font-bold tracking-tight leading-none">{value}</p>
      {trend && (
        <p className={`text-xs mt-2 font-medium ${trend.positive ? 'text-[#3ab48c]' : 'text-red-400'}`}>
          {trend.positive ? '+' : ''}{trend.value}
        </p>
      )}
      {sub && !trend && <p className="text-xs mt-2 text-muted-foreground">{sub}</p>}
    </div>
  )
  if (href) return <Link href={href} className="block">{inner}</Link>
  return inner
}

// ── Area Chart (SVG) ─────────────────────────────────────────────
function AreaChart({ data }: { data: { date: string; revenue: number; cost: number }[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
        No data yet
      </div>
    )
  }

  const W = 560; const H = 140; const PAD = { top: 12, right: 8, bottom: 24, left: 44 }
  const iW = W - PAD.left - PAD.right
  const iH = H - PAD.top - PAD.bottom

  const maxVal = Math.max(...data.map(d => d.revenue), ...data.map(d => d.cost), 1)
  const steps  = data.length

  function x(i: number) { return PAD.left + (i / (steps - 1)) * iW }
  function y(v: number) { return PAD.top + iH - (v / maxVal) * iH }

  function linePath(vals: number[]) {
    return vals.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  }

  function areaPath(vals: number[]) {
    const line = linePath(vals)
    const last = vals.length - 1
    return `${line} L ${x(last).toFixed(1)} ${(PAD.top + iH).toFixed(1)} L ${PAD.left.toFixed(1)} ${(PAD.top + iH).toFixed(1)} Z`
  }

  // Y-axis labels
  const yLabels = [0, 0.25, 0.5, 0.75, 1].map(f => ({
    v: maxVal * f,
    y: y(maxVal * f),
  }))

  // X-axis: show first/last date labels
  const xLabels = [0, Math.floor(steps / 2), steps - 1].map(i => ({
    label: new Date(data[i].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    x: x(i),
  }))

  function fmtY(v: number) {
    if (v === 0) return '0'
    if (v >= 1000) return `${(v / 1000).toFixed(0)}k`
    return Math.round(v).toString()
  }

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="overflow-visible">
      <defs>
        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2f5fff" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#2f5fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9ca0a8" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#9ca0a8" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {yLabels.map(({ y: yv }, i) => (
        <line key={i} x1={PAD.left} y1={yv} x2={PAD.left + iW} y2={yv}
          stroke="#e6e6e2" strokeWidth="1" />
      ))}

      {/* Y labels */}
      {yLabels.map(({ v, y: yv }, i) => (
        <text key={i} x={PAD.left - 6} y={yv + 4} textAnchor="end"
          fontSize="9" fill="#9ca0a8">{fmtY(v)}</text>
      ))}

      {/* X labels */}
      {xLabels.map(({ label, x: xv }, i) => (
        <text key={i} x={xv} y={H - 2} textAnchor="middle"
          fontSize="9" fill="#9ca0a8">{label}</text>
      ))}

      {/* Cost area */}
      <path d={areaPath(data.map(d => d.cost))} fill="url(#costGrad)" />
      {/* Revenue area */}
      <path d={areaPath(data.map(d => d.revenue))} fill="url(#revGrad)" />

      {/* Cost line (dashed) */}
      <path d={linePath(data.map(d => d.cost))}
        fill="none" stroke="#c5c8ce" strokeWidth="1.5"
        strokeDasharray="4 3" />
      {/* Revenue line */}
      <path d={linePath(data.map(d => d.revenue))}
        fill="none" stroke="#2f5fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Status badge ─────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? status
  const color = STATUS_COLORS[status as keyof typeof STATUS_COLORS] ?? 'bg-zinc-100 text-zinc-500'
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${color}`}>
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {label}
    </span>
  )
}

// ── Page ─────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { t, fmtCurrency } = useT()
  const [data, setData]   = useState<DashboardData | null>(null)

  useEffect(() => {
    getDashboardData().then(setData).catch(() => setData(null))
  }, [])

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <div className="max-w-[1100px] space-y-6">

      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.dashboard.title}</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5 capitalize">{today}</p>
        </div>
        <Link
          href="/pedidos"
          className="flex items-center gap-1.5 bg-[#0f1115] hover:bg-[#1c1f28] text-white text-[13px] font-semibold px-4 py-2 rounded-lg transition-colors shrink-0"
        >
          <Plus className="size-4" /> New order
        </Link>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-3">
        {!data ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card px-5 py-4">
              <Skeleton className="h-3 w-20 mb-3" />
              <Skeleton className="h-6 w-28" />
            </div>
          ))
        ) : (
          <>
            <KpiCard
              label="Revenue (this month)"
              value={fmtCurrency(data.monthlyRevenue)}
              href="/cash-flow"
            />
            <KpiCard
              label="Active orders"
              value={String(data.activeOrders)}
              href="/pedidos"
            />
            <KpiCard
              label="Expenses (this month)"
              value={fmtCurrency(data.monthlyExpenses)}
              href="/cash-flow"
            />
            <KpiCard
              label="Filament spent"
              value={fmtWeight(data.filamentSpentKg)}
              href="/filamentos"
            />
          </>
        )}
      </div>

      {/* Chart + Stock row */}
      <div className="grid grid-cols-[1fr_280px] gap-4">

        {/* Revenue chart */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[13px] font-semibold">Revenue · last 30 days</p>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="inline-block size-2 rounded-full bg-[#2f5fff]" />
                Revenue
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="inline-block w-4 h-0.5 border-b border-dashed border-[#9ca0a8]" />
                Cost
              </span>
            </div>
          </div>
          <div className="h-[160px] w-full">
            {data ? (
              <AreaChart data={data.chartDays} />
            ) : (
              <Skeleton className="h-full w-full" />
            )}
          </div>
        </div>

        {/* Filament stock */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[13px] font-semibold">Filament stock</p>
            <Link href="/filamentos" className="text-[11px] text-[#2f5fff] hover:underline flex items-center gap-0.5">
              All <ArrowUpRight className="size-3" />
            </Link>
          </div>

          {!data ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : data.filamentStock.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No filament registered</p>
          ) : (
            <div className="space-y-3">
              {data.filamentStock.map((f, i) => {
                const pct = f.totalG > 0 ? Math.max(5, Math.round((f.remainingG / f.totalG) * 100)) : 0
                const low = pct < 20
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full shrink-0" style={{ background: f.colorHex }} />
                        <span className="text-[12px] font-medium truncate max-w-[120px]">{f.name}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground tabular-nums">{fmtWeight(f.remainingG / 1000)}</span>
                    </div>
                    <div className="h-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          background: low ? '#f87171' : f.colorHex,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent orders */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <p className="text-[13px] font-semibold">Recent orders</p>
          <Link href="/pedidos" className="text-[11px] text-[#2f5fff] hover:underline flex items-center gap-0.5">
            View all <ArrowUpRight className="size-3" />
          </Link>
        </div>

        {!data ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-36 flex-1" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        ) : data.recentOrders.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-10">No orders yet</p>
        ) : (
          <div className="divide-y divide-border">
            {data.recentOrders.map(order => (
              <Link
                key={order.id}
                href="/pedidos"
                className="flex items-center gap-4 px-5 py-3 hover:bg-muted/30 transition-colors text-[13px]"
              >
                <span className="text-muted-foreground font-mono text-[11px] w-14 shrink-0">
                  #{order.id.slice(0, 6).toUpperCase()}
                </span>
                <span className="font-medium w-32 shrink-0 truncate">{order.clientName}</span>
                <span className="flex-1 text-muted-foreground truncate">{order.productName}</span>
                <StatusBadge status={order.status} />
                <span className="font-semibold tabular-nums shrink-0">{fmtCurrency(order.amount)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
