'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Calculator, Package, Layers, ClipboardList, LayoutDashboard, LogOut,
  CreditCard, Printer, Users, Truck, Receipt, TrendingUp, Settings,
  Globe, Wallet, FileText, Kanban, FlaskConical, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useT, type Lang } from '@/lib/i18n'

export function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const { t, lang, setLang } = useT()

  const NAV_GROUPS = [
    {
      label: null,
      items: [
        { href: '/dashboard',    label: t.nav.dashboard,  icon: LayoutDashboard },
        { href: '/precificacao', label: t.nav.pricing,    icon: Calculator },
      ],
    },
    {
      label: 'Insumos',
      items: [
        { href: '/filamentos',   label: t.nav.materials,   icon: Layers },
        { href: '/printers',     label: t.nav.equipment,   icon: Printer },
        { href: '/consumables',  label: t.nav.consumables, icon: FlaskConical },
        { href: '/produtos',     label: t.nav.products,    icon: Package },
      ],
    },
    {
      label: 'Operação',
      items: [
        { href: '/pedidos',    label: t.nav.orders,      icon: ClipboardList },
        { href: '/quotes',     label: t.nav.quotes,      icon: FileText },
        { href: '/production', label: t.nav.production,  icon: Kanban },
        { href: '/clients',    label: t.nav.clients,     icon: Users },
        { href: '/suppliers',  label: t.nav.suppliers,   icon: Truck },
      ],
    },
    {
      label: 'Financeiro',
      items: [
        { href: '/expenses',   label: t.nav.expenses,  icon: Receipt },
        { href: '/cash-flow',  label: t.nav.cashFlow,  icon: TrendingUp },
        { href: '/wallet',     label: t.nav.wallet,    icon: Wallet },
      ],
    },
  ]

  const LANGS: { code: Lang; flag: string; label: string }[] = [
    { code: 'en', flag: '🇺🇸', label: 'EN' },
    { code: 'pt', flag: '🇧🇷', label: 'PT' },
    { code: 'es', flag: '🇪🇸', label: 'ES' },
  ]

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-56 shrink-0 border-r border-[#ececea] bg-[#fafafa] flex flex-col h-screen sticky top-0">

      {/* Logo */}
      <div className="px-5 py-4 border-b border-[#ececea]">
        <div className="flex items-center gap-2.5">
          <FilametryMark />
          <span className="font-semibold text-[15px] tracking-[-0.03em] text-foreground">Filametry</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi}>
            {group.label && (
              <p className="px-2.5 mb-1 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-[0.08em]">
                {group.label}
              </p>
            )}
            <div className="space-y-px">
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'group flex items-center gap-2.5 px-2.5 py-[7px] rounded-[7px] text-[13px] font-medium transition-all duration-100',
                      active
                        ? 'bg-[#eef1ff] text-[#2f5fff]'
                        : 'text-[#3a3f4a] hover:bg-[#f1f2f5] hover:text-foreground'
                    )}
                  >
                    <Icon className={cn('size-[15px] shrink-0 transition-colors', active ? 'text-[#2f5fff]' : 'text-[#9ca0a8] group-hover:text-foreground')} />
                    <span className="flex-1 truncate">{label}</span>
                    {active && <ChevronRight className="size-3 text-[#2f5fff]/50 shrink-0" />}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-3 pt-2 border-t border-[#ececea] space-y-0.5">
        {/* Language */}
        <div className="flex items-center gap-0.5 px-2.5 py-1.5">
          <Globe className="size-3.5 text-muted-foreground/60 mr-1.5 shrink-0" />
          {LANGS.map(({ code, flag, label }) => (
            <button
              key={code}
              onClick={() => setLang(code)}
              title={t.lang[code]}
              className={cn(
                'text-[11px] px-1.5 py-0.5 rounded-md font-medium transition-colors',
                lang === code
                  ? 'bg-[#eef1ff] text-[#2f5fff]'
                  : 'text-muted-foreground/60 hover:text-foreground'
              )}
            >
              {flag}
            </button>
          ))}
        </div>

        <Link
          href="/settings"
          className={cn(
            'flex items-center gap-2.5 px-2.5 py-[7px] rounded-[7px] text-[13px] font-medium transition-all',
            pathname === '/settings'
              ? 'bg-[#eef1ff] text-[#2f5fff]'
              : 'text-[#3a3f4a] hover:bg-[#f1f2f5] hover:text-foreground'
          )}
        >
          <Settings className="size-[15px] shrink-0 text-[#9ca0a8]" />
          {t.nav.settings}
        </Link>

        <Link
          href="/billing"
          className={cn(
            'flex items-center gap-2.5 px-2.5 py-[7px] rounded-[7px] text-[13px] font-medium transition-all',
            pathname === '/billing'
              ? 'bg-[#eef1ff] text-[#2f5fff]'
              : 'text-[#3a3f4a] hover:bg-[#f1f2f5] hover:text-foreground'
          )}
        >
          <CreditCard className="size-[15px] shrink-0 text-[#9ca0a8]" />
          {t.nav.billing}
        </Link>

        <button
          onClick={signOut}
          className="w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-[7px] text-[13px] text-[#3a3f4a] hover:text-foreground hover:bg-[#f1f2f5] transition-all font-medium"
        >
          <LogOut className="size-[15px] shrink-0 text-[#9ca0a8]" />
          {t.nav.signOut}
        </button>
      </div>
    </aside>
  )
}

/** Filametry logomark — gradient square with inner square outline */
function FilametryMark() {
  return (
    <div
      className="relative shrink-0"
      style={{
        width: 26, height: 26,
        borderRadius: 7,
        background: 'linear-gradient(135deg, #2f5fff 0%, #7a3cff 100%)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 6,
          borderRadius: 3,
          border: '2px solid rgba(255,255,255,0.85)',
        }}
      />
    </div>
  )
}
