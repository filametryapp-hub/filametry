'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard, ClipboardList, FileText, Layers, Package,
  Printer, History, Kanban, Users, CreditCard, Plug, LogOut, Globe,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { getCompany } from '@/lib/actions/company'
import { useT, type Lang } from '@/lib/i18n'

// ── Types ────────────────────────────────────────────────────────
interface NavItem {
  href:   string
  label:  string
  icon:   React.ElementType
  badge?: number
}

// ── Badge dot ────────────────────────────────────────────────────
function Badge({ n }: { n: number }) {
  if (!n) return null
  return (
    <span className="ml-auto text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full bg-[#eef1ff] text-[#2f5fff] leading-none">
      {n}
    </span>
  )
}

// ── Nav link ─────────────────────────────────────────────────────
function NavLink({ href, label, icon: Icon, badge, active }: NavItem & { active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        'group flex items-center gap-2.5 px-2.5 py-[7px] rounded-[7px] text-[13px] font-medium transition-all duration-100',
        active
          ? 'bg-[#eef1ff] text-[#2f5fff]'
          : 'text-[#3a3f4a] hover:bg-[#f1f2f5] hover:text-foreground',
      )}
    >
      <Icon
        className={cn(
          'size-[15px] shrink-0 transition-colors',
          active ? 'text-[#2f5fff]' : 'text-[#9ca0a8] group-hover:text-foreground',
        )}
      />
      <span className="flex-1 truncate">{label}</span>
      {badge !== undefined && <Badge n={badge} />}
    </Link>
  )
}

// ── Main component ───────────────────────────────────────────────
export function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const { t, lang, setLang } = useT()

  const LANGS: { code: Lang; flag: string }[] = [
    { code: 'en', flag: '🇺🇸' },
    { code: 'pt', flag: '🇧🇷' },
    { code: 'es', flag: '🇪🇸' },
  ]

  const [companyName, setCompanyName] = useState('')
  const [companyCity, setCompanyCity] = useState('')

  // Badge counts — fetched lightly (just counts, no heavy data)
  const [orderBadge,   setOrderBadge]   = useState(0)
  const [quoteBadge,   setQuoteBadge]   = useState(0)
  const [printerBadge, setPrinterBadge] = useState(0)

  useEffect(() => {
    // Company name
    getCompany().then(c => {
      if (c) { setCompanyName(c.name ?? ''); setCompanyCity(c.city ?? '') }
    }).catch(() => {})

    // Counts
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      Promise.all([
        supabase.from('orders').select('id,status').eq('user_id', user.id),
        supabase.from('quotes').select('id,status').eq('user_id', user.id),
        supabase.from('printers').select('id').eq('user_id', user.id),
      ]).then(([orders, quotes, printers]) => {
        const active = (orders.data ?? []).filter(
          (o: { status: string }) => !['done', 'cancelled'].includes(o.status)
        ).length
        const aq = (quotes.data ?? []).filter(
          (q: { status: string }) => q.status !== 'rejected'
        ).length
        setOrderBadge(active)
        setQuoteBadge(aq)
        setPrinterBadge(printers.data?.length ?? 0)
      })
    })
  }, [])

  const NAV: NavItem[] = [
    { href: '/dashboard',  label: t.nav.dashboard,    icon: LayoutDashboard },
    { href: '/pedidos',    label: t.nav.orders,        icon: ClipboardList,  badge: orderBadge },
    { href: '/quotes',     label: t.nav.quotes,        icon: FileText,       badge: quoteBadge },
    { href: '/production', label: t.nav.production,    icon: Kanban },
    { href: '/filamentos', label: t.nav.materials,     icon: Layers },
    { href: '/produtos',   label: t.nav.products,      icon: Package },
    { href: '/printers',   label: t.nav.equipment,     icon: Printer,        badge: printerBadge },
    { href: '/cash-flow',  label: t.nav.cashFlow,      icon: History },
  ]

  const SETTINGS: NavItem[] = [
    { href: '/settings',  label: t.nav.team,    icon: Users },
    { href: '/billing',   label: t.nav.billing, icon: CreditCard },
    { href: '/settings',  label: t.nav.integrations, icon: Plug },
  ]

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const displayName = companyName.toUpperCase()
  const displayCity = companyCity.toUpperCase()

  return (
    <aside className="w-52 shrink-0 border-r border-[#ececea] bg-[#fafafa] flex flex-col h-screen sticky top-0">

      {/* Company header */}
      <div className="px-4 py-4 border-b border-[#ececea]">
        {displayName ? (
          <div>
            <p className="text-[10px] font-semibold tracking-[0.1em] text-[#9ca0a8] uppercase leading-none mb-0.5">
              {displayName}{displayCity ? ` · ${displayCity}` : ''}
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <FilametryMark />
            <span className="font-semibold text-[14px] tracking-[-0.02em] text-foreground">Filametry</span>
          </div>
        )}
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-3 py-3 space-y-px overflow-y-auto">
        {NAV.map(item => (
          <NavLink key={item.href + item.label} {...item} active={pathname === item.href} />
        ))}

        {/* Settings section */}
        <div className="pt-4">
          <p className="px-2.5 mb-1 text-[9px] font-bold text-[#9ca0a8] uppercase tracking-[0.12em]">
            {t.nav.settings}
          </p>
          {SETTINGS.map(item => (
            <NavLink key={item.href + item.label} {...item} active={pathname === item.href && item.href !== '/settings' || false} />
          ))}
        </div>
      </nav>

      {/* Footer: language + sign out */}
      <div className="px-3 pb-3 pt-2 border-t border-[#ececea] space-y-0.5">
        {/* Language picker */}
        <div className="flex items-center gap-0.5 px-2.5 py-1.5">
          <Globe className="size-3.5 text-muted-foreground/60 mr-1 shrink-0" />
          {LANGS.map(({ code, flag }) => (
            <button
              key={code}
              onClick={() => setLang(code)}
              title={t.lang[code]}
              className={cn(
                'text-[11px] px-1.5 py-0.5 rounded-md font-medium transition-colors',
                lang === code
                  ? 'bg-[#eef1ff] text-[#2f5fff]'
                  : 'text-muted-foreground/60 hover:text-foreground',
              )}
            >
              {flag}
            </button>
          ))}
        </div>

        <button
          onClick={signOut}
          className="w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-[7px] text-[13px] text-[#9ca0a8] hover:text-foreground hover:bg-[#f1f2f5] transition-all font-medium"
        >
          <LogOut className="size-[15px] shrink-0" />
          {t.nav.signOut}
        </button>
      </div>
    </aside>
  )
}

/** Filametry logomark */
function FilametryMark() {
  return (
    <div
      className="relative shrink-0"
      style={{
        width: 22, height: 22,
        borderRadius: 6,
        background: 'linear-gradient(135deg, #2f5fff 0%, #7a3cff 100%)',
      }}
    >
      <div
        style={{
          position: 'absolute', inset: 5, borderRadius: 2,
          border: '1.5px solid rgba(255,255,255,0.85)',
        }}
      />
    </div>
  )
}
