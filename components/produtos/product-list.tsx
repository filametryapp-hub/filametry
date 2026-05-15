'use client'

import { useState } from 'react'
import { Plus, Package, Pencil, Trash2, Tag } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ProductForm } from './product-form'
import type { Product } from '@/lib/product-types'

const DEMO: Product[] = [
  {
    id: '1',
    name: 'Rolling Egg Box',
    description: 'Egg storage organizer with rolling mechanism.',
    material: 'PLA Matte',
    weightG: 132,
    printHours: 3.2,
    costUSD: 4.80,
    priceUSD: 18.00,
    tags: ['kitchen', 'organizer'],
    createdAt: '2025-04-01',
  },
  {
    id: '2',
    name: 'Cable Clip Set (×10)',
    description: 'Desk cable management clips, 10-pack.',
    material: 'PETG',
    weightG: 28,
    printHours: 0.8,
    costUSD: 1.10,
    priceUSD: 6.00,
    tags: ['desk', 'cable'],
    createdAt: '2025-04-10',
  },
  {
    id: '3',
    name: 'Phone Stand',
    description: 'Adjustable phone/tablet stand.',
    material: 'ABS',
    weightG: 85,
    printHours: 2.1,
    costUSD: 3.20,
    priceUSD: 12.00,
    tags: ['desk', 'phone'],
    createdAt: '2025-04-15',
  },
]

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function margin(cost: number, price: number) {
  if (price === 0) return 0
  return ((price - cost) / price) * 100
}

function ProductCard({ product, onEdit, onDelete }: {
  product: Product
  onEdit: () => void
  onDelete: () => void
}) {
  const m = margin(product.costUSD, product.priceUSD)
  const profit = product.priceUSD - product.costUSD

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden hover:border-orange-500/30 transition-colors group">
      {/* Image placeholder */}
      <div className="h-36 bg-muted/40 flex items-center justify-center border-b border-border">
        <Package className="size-10 text-muted-foreground/30" />
      </div>

      <div className="p-4 space-y-3">
        {/* Title + actions */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-sm leading-tight">{product.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{product.description}</p>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button onClick={onEdit}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <Pencil className="size-3.5" />
            </button>
            <button onClick={onDelete}
              className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors">
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Tags */}
        {product.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {product.tags.map(t => (
              <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{t}</span>
            ))}
          </div>
        )}

        {/* Specs */}
        <div className="text-xs text-muted-foreground flex gap-3">
          <span>{product.material}</span>
          <span>·</span>
          <span>{product.weightG}g</span>
          <span>·</span>
          <span>{product.printHours}h</span>
        </div>

        {/* Pricing */}
        <div className="pt-2 border-t border-border grid grid-cols-3 gap-2">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Cost</p>
            <p className="text-sm font-mono font-medium">{fmt(product.costUSD)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Profit</p>
            <p className="text-sm font-mono font-medium text-green-400">{fmt(profit)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Price</p>
            <p className="text-sm font-mono font-bold text-orange-500">{fmt(product.priceUSD)}</p>
          </div>
        </div>

        {/* Margin bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Margin</span><span>{m.toFixed(0)}%</span>
          </div>
          <div className="h-1 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-orange-500 transition-all" style={{ width: `${Math.min(100, m)}%` }} />
          </div>
        </div>
      </div>
    </div>
  )
}

export function ProductList() {
  const [products, setProducts] = useState<Product[]>(DEMO)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [search, setSearch] = useState('')

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.material.toLowerCase().includes(search.toLowerCase()) ||
    p.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
  )

  const totalValue = products.reduce((s, p) => s + p.priceUSD, 0)
  const avgMargin  = products.length
    ? products.reduce((s, p) => s + margin(p.costUSD, p.priceUSD), 0) / products.length
    : 0

  function save(data: Product) {
    if (editing) {
      setProducts(prev => prev.map(p => p.id === data.id ? data : p))
    } else {
      setProducts(prev => [...prev, { ...data, id: crypto.randomUUID() }])
    }
    setEditing(null)
    setShowForm(false)
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Products',      value: products.length.toString() },
          { label: 'Catalog value', value: fmt(totalValue) },
          { label: 'Avg margin',    value: `${avgMargin.toFixed(0)}%` },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-border bg-card px-5 py-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <input
          type="search"
          placeholder="Search products…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
        />
        <button
          onClick={() => { setEditing(null); setShowForm(true) }}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors whitespace-nowrap"
        >
          <Plus className="size-4" /> Add product
        </button>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <Package className="size-8 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-sm text-muted-foreground">
            {search ? 'No products match your search.' : 'No products yet. Add your first item.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => (
            <ProductCard
              key={p.id}
              product={p}
              onEdit={() => { setEditing(p); setShowForm(true) }}
              onDelete={() => setProducts(prev => prev.filter(x => x.id !== p.id))}
            />
          ))}
        </div>
      )}

      {showForm && (
        <ProductForm
          initial={editing}
          onSave={save}
          onClose={() => { setShowForm(false); setEditing(null) }}
        />
      )}
    </div>
  )
}
