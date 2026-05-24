'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Receipt } from 'lucide-react'
import { FilamentList } from '@/components/filaments/filament-list'
import { ConsumablesSection } from '@/components/consumables/consumables-section'
import { cn } from '@/lib/utils'

const TABS = [
  { id: 'filaments',    label: 'Filamentos' },
  { id: 'consumables',  label: 'Pós-processamento' },
] as const
type Tab = (typeof TABS)[number]['id']

export default function FilamentosPage() {
  const [tab, setTab] = useState<Tab>('filaments')

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Materiais</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Filamentos e materiais de pós-processamento.
          </p>
        </div>
        <Link
          href={`/expenses?category=${tab === 'consumables' ? 'post_processing' : 'material'}&open=1`}
          className="flex items-center gap-1.5 text-sm font-medium border border-border px-3 py-2 rounded-lg hover:bg-muted hover:border-blue-600/50 hover:text-blue-600 transition-colors whitespace-nowrap"
        >
          <Receipt className="size-3.5" /> Lançar compra
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit mb-6">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-4 py-1.5 rounded-md text-sm font-medium transition-all',
              tab === t.id
                ? 'bg-white shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'filaments'   && <FilamentList />}
      {tab === 'consumables' && <ConsumablesSection />}
    </div>
  )
}
