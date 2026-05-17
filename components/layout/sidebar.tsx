'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Calculator, Package, Layers, ClipboardList, LayoutDashboard, LogOut, CreditCard, Printer, Users, Truck, Receipt, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { href: '/dashboard',      label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/precificacao',   label: 'Pricing',        icon: Calculator },
  { href: '/filamentos',     label: 'Filaments',      icon: Layers },
  { href: '/printers',       label: 'Printers',       icon: Printer },
  { href: '/produtos',       label: 'Products',       icon: Package },
  { href: '/pedidos',        label: 'Orders',         icon: ClipboardList },
  { href: '/clients',        label: 'Clients',        icon: Users },
  { href: '/suppliers',      label: 'Suppliers',      icon: Truck },
  { href: '/expenses',       label: 'Expenses',       icon: Receipt },
  { href: '/cash-flow',      label: 'Cash Flow',      icon: TrendingUp },
]

export function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-60 shrink-0 border-r border-border bg-background flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-border">
        <div className="flex items-center gap-3">
          <FilametryIcon />
          <span className="font-bold text-lg tracking-tight">Filametry</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              pathname === href
                ? 'bg-orange-500/10 text-orange-500'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-border space-y-1">
        <Link
          href="/billing"
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
            pathname === '/billing'
              ? 'bg-orange-500/10 text-orange-500'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          )}
        >
          <CreditCard className="size-4 shrink-0" />
          Billing
        </Link>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <LogOut className="size-4 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  )
}

function FilametryIcon() {
  const bars = [
    { w: 18 }, { w: 6 }, { w: 6 }, { w: 13 }, { w: 6 }, { w: 6 }, { w: 6 },
  ]
  return (
    <div className="flex flex-col gap-[2px]">
      {bars.map((b, i) => (
        <div
          key={i}
          className="h-[3px] bg-orange-500 rounded-full"
          style={{ width: b.w }}
        />
      ))}
    </div>
  )
}
