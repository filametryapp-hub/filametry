'use client'

import { useState, useMemo } from 'react'
import { Search, Cpu } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { getPrintersByBrand, PRINTERS, type Printer } from '@/lib/printers'
import { cn } from '@/lib/utils'

interface Props {
  value: string
  onChange: (printer: Printer) => void
}

export function PrinterSelect({ value, onChange }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const selected = PRINTERS.find(p => p.id === value)

  const filtered = useMemo(() => {
    if (!query) return getPrintersByBrand()
    const q = query.toLowerCase()
    const matches = PRINTERS.filter(
      p => p.brand.toLowerCase().includes(q) || p.model.toLowerCase().includes(q)
    )
    return matches.reduce((acc, p) => {
      if (!acc[p.brand]) acc[p.brand] = []
      acc[p.brand].push(p)
      return acc
    }, {} as Record<string, Printer[]>)
  }, [query])

  const brands = Object.keys(filtered).sort()

  return (
    <div className="space-y-1.5 relative">
      <label className="text-xs text-muted-foreground">Printer model</label>

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          'w-full flex items-center gap-2 h-8 px-3 rounded-md border border-input bg-background text-sm text-left transition-colors',
          'hover:border-orange-500/50 focus:outline-none focus:border-orange-500',
          open && 'border-orange-500'
        )}
      >
        <Cpu className="size-3.5 text-muted-foreground shrink-0" />
        <span className={selected ? 'text-foreground' : 'text-muted-foreground'}>
          {selected ? `${selected.brand} ${selected.model}` : 'Select your printer…'}
        </span>
        {selected && (
          <span className="ml-auto text-xs text-muted-foreground font-mono">{selected.watts}W</span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-xl border border-border bg-popover shadow-xl overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Search brand or model…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="pl-8 h-7 text-sm"
              />
            </div>
          </div>

          {/* List */}
          <div className="max-h-72 overflow-y-auto">
            {brands.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground text-center">No printers found.</p>
            )}
            {brands.map(brand => (
              <div key={brand}>
                <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/40 sticky top-0">
                  {brand}
                </div>
                {filtered[brand].map(printer => (
                  <button
                    key={printer.id}
                    type="button"
                    onClick={() => { onChange(printer); setOpen(false); setQuery('') }}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted transition-colors',
                      printer.id === value && 'bg-orange-500/10 text-orange-500'
                    )}
                  >
                    <span>{printer.model}</span>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {printer.buildVolume && <span className="hidden sm:block">{printer.buildVolume}</span>}
                      <span className="font-mono">{printer.watts}W</span>
                      <span className={cn(
                        'px-1.5 py-0.5 rounded text-[10px] font-medium',
                        printer.type === 'FDM'   ? 'bg-blue-500/10 text-blue-400'   : 'bg-purple-500/10 text-purple-400'
                      )}>
                        {printer.type}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Overlay to close */}
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
    </div>
  )
}
