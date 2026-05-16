import { Calculator, Layers, Package, ClipboardList, Printer } from 'lucide-react'
import Link from 'next/link'
import { getProfile } from '@/lib/actions/billing'
import { getPrinterCount } from '@/lib/actions/printers'
import { TRIAL_PRINTER_LIMIT } from '@/lib/stripe/plans'

const CARDS = [
  {
    href: '/precificacao',
    icon: Calculator,
    title: 'Pricing Calculator',
    description: 'Calculate cost per gram, print time, energy, and margin.',
    color: 'text-orange-500',
    bg: 'bg-orange-500/10',
  },
  {
    href: '/filamentos',
    icon: Layers,
    title: 'Filaments',
    description: 'Track your spool stock, cost per material, and consumption.',
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
  },
  {
    href: '/produtos',
    icon: Package,
    title: 'Products',
    description: 'Manage your catalog with photos, materials, and pricing.',
    color: 'text-green-400',
    bg: 'bg-green-400/10',
  },
  {
    href: '/pedidos',
    icon: ClipboardList,
    title: 'Orders',
    description: 'Generate quotes and track order status for clients.',
    color: 'text-purple-400',
    bg: 'bg-purple-400/10',
  },
]

export default async function DashboardPage() {
  const profile      = await getProfile()
  const printerCount = await getPrinterCount()
  const printerLimit: number = profile?.printer_limit ?? TRIAL_PRINTER_LIMIT
  const displayLimit = printerLimit === 9999 ? '∞' : String(printerLimit)
  const pct = printerLimit === 9999 ? 0 : Math.min(100, Math.round((printerCount / printerLimit) * 100))

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome to Filametry. What would you like to do today?</p>
      </div>

      {/* Printer usage widget */}
      <Link
        href="/printers"
        className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 mb-6 hover:border-orange-500/40 transition-colors group"
      >
        <div className="p-2.5 rounded-lg bg-orange-500/10">
          <Printer className="size-5 text-orange-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-sm font-medium group-hover:text-orange-500 transition-colors">
              Registered Printers
            </p>
            <span className="text-sm font-semibold tabular-nums">
              {printerCount} / {displayLimit}
            </span>
          </div>
          {printerLimit !== 9999 && (
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-orange-400' : 'bg-orange-500'
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
            className="group rounded-xl border border-border bg-card p-6 hover:border-orange-500/40 transition-colors"
          >
            <div className={`inline-flex p-2.5 rounded-lg ${bg} mb-4`}>
              <Icon className={`size-5 ${color}`} />
            </div>
            <h2 className="font-semibold mb-1 group-hover:text-orange-500 transition-colors">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
