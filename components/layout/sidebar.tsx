'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Calculator, Package, Layers, ClipboardList, LayoutDashboard, LogOut, CreditCard, Printer, Users, Truck, Receipt, TrendingUp, Settings, Globe, Wallet, FileText, Kanban } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useT, type Lang } from '@/lib/i18n'

export function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const { t, lang, setLang } = useT()

  const NAV = [
    { href: '/dashboard',    label: t.nav.dashboard,  icon: LayoutDashboard },
    { href: '/precificacao', label: t.nav.pricing,    icon: Calculator },
    { href: '/filamentos',   label: t.nav.materials,  icon: Layers },
    { href: '/printers',     label: t.nav.equipment,  icon: Printer },
    { href: '/produtos',     label: t.nav.products,   icon: Package },
    { href: '/pedidos',      label: t.nav.orders,     icon: ClipboardList },
    { href: '/quotes',       label: t.nav.quotes,     icon: FileText },
    { href: '/production',   label: t.nav.production, icon: Kanban },
    { href: '/clients',      label: t.nav.clients,    icon: Users },
    { href: '/suppliers',    label: t.nav.suppliers,  icon: Truck },
    { href: '/expenses',     label: t.nav.expenses,   icon: Receipt },
    { href: '/cash-flow',    label: t.nav.cashFlow,   icon: TrendingUp },
    { href: '/wallet',       label: t.nav.wallet,     icon: Wallet },
    { href: '/settings',     label: t.nav.settings,   icon: Settings },
  ]

  const LANGS: { code: Lang; flag: string }[] = [
    { code: 'en', flag: '🇺🇸' },
    { code: 'pt', flag: '🇧🇷' },
    { code: 'es', flag: '🇪🇸' },
  ]

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
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
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
        {/* Language switcher */}
        <div className="flex items-center gap-1 px-3 py-2">
          <Globe className="size-3.5 text-muted-foreground shrink-0" />
          <div className="flex gap-1 ml-1">
            {LANGS.map(({ code, flag }) => (
              <button
                key={code}
                onClick={() => setLang(code)}
                title={t.lang[code]}
                className={cn(
                  'text-sm px-1.5 py-0.5 rounded transition-colors',
                  lang === code
                    ? 'bg-orange-500/10 text-orange-500 font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {flag}
              </button>
            ))}
          </div>
        </div>

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
          {t.nav.billing}
        </Link>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <LogOut className="size-4 shrink-0" />
          {t.nav.signOut}
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
