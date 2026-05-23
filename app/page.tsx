import Link from 'next/link'
import { Calculator, Layers, Package, ClipboardList, ArrowRight } from 'lucide-react'

const FEATURES = [
  { icon: Calculator, title: 'Smart Pricing',     desc: 'Calculate cost per gram, print time, energy, and margin automatically.' },
  { icon: Layers,     title: 'Filament Tracking', desc: 'Monitor your spool inventory, material costs, and consumption over time.' },
  { icon: Package,    title: 'Product Catalog',   desc: 'Keep a catalog of your printable parts with photos, specs, and pricing.' },
  { icon: ClipboardList, title: 'Orders & Quotes', desc: 'Generate professional quotes and track orders from start to delivery.' },
]

function FilametryMark() {
  const bars = [
    { w: 36 }, { w: 12 }, { w: 12 }, { w: 27 }, { w: 12 }, { w: 12 }, { w: 12 },
  ]
  return (
    <div className="flex flex-col gap-[3px]">
      {bars.map((b, i) => (
        <div key={i} className="h-[5px] bg-blue-600 rounded-full" style={{ width: b.w }} />
      ))}
    </div>
  )
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Nav */}
      <header className="border-b border-border px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FilametryMark />
          <span className="font-bold text-lg tracking-tight">Filametry</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Sign in
          </Link>
          <Link
            href="/register"
            className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors"
          >
            Start free trial
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-8 py-24">
        <div className="inline-flex items-center gap-2 text-xs text-blue-600 border border-blue-600/30 bg-blue-600/10 px-3 py-1 rounded-full mb-6 font-mono">
          7-day free trial · no credit card required
        </div>
        <h1 className="text-5xl font-bold tracking-tight max-w-2xl mb-4">
          Print smarter.<br />Price better.
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl mb-10">
          The all-in-one management tool for 3D printing businesses. Track filaments, price your prints, and manage orders — from a single dashboard.
        </p>
        <div className="flex items-center gap-3">
          <Link
            href="/register"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md font-medium transition-colors"
          >
            Get started free <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/login"
            className="px-6 py-3 rounded-md font-medium text-muted-foreground hover:text-foreground border border-border hover:border-muted-foreground transition-colors"
          >
            Sign in
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border px-8 py-20">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-6">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-6">
              <div className="inline-flex p-2 rounded-lg bg-blue-600/10 mb-4">
                <Icon className="size-5 text-blue-600" />
              </div>
              <h3 className="font-semibold mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-8 py-6 text-center text-xs text-muted-foreground font-mono">
        © {new Date().getFullYear()} Filametry · filametry.com
      </footer>
    </div>
  )
}
