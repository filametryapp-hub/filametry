'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Package, Pencil, Trash2, FlaskConical } from 'lucide-react'
import { ProductForm } from './product-form'
import { TestPrintsSection } from './test-prints-section'
import { getProducts, upsertProduct, deleteProduct } from '@/lib/actions/products'
import type { Product } from '@/lib/product-types'

// Map DB row (snake_case) → Product (camelCase)
function fromRow(row: Record<string, unknown>): Product {
  return {
    id:          String(row.id),
    name:        String(row.name),
    description: String(row.description ?? ''),
    material:    String(row.material),
    weightG:     Number(row.weight_g),
    printHours:  Number(row.print_hours),
    costUSD:     Number(row.cost_usd),
    priceUSD:    Number(row.price_usd),
    imageUrl:    row.image_url ? String(row.image_url) : undefined,
    tags:        Array.isArray(row.tags) ? (row.tags as string[]) : [],
    createdAt:   String(row.created_at ?? ''),
  }
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function margin(cost: number, price: number) {
  if (price === 0) return 0
  return ((price - cost) / price) * 100
}

function ProductCard({ product, onEdit, onDelete, onRegisterTest }: {
  product: Product
  onEdit: () => void
  onDelete: () => void
  onRegisterTest: () => void
}) {
  const m = margin(product.costUSD, product.priceUSD)
  const profit = product.priceUSD - product.costUSD

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden hover:border-orange-500/30 transition-colors group">
      <div className="h-36 bg-muted/40 flex items-center justify-center border-b border-border">
        <Package className="size-10 text-muted-foreground/30" />
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-sm leading-tight">{product.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{product.description}</p>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              onClick={onRegisterTest}
              title="Registrar teste / perda"
              className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors"
            >
              <FlaskConical className="size-3.5" />
            </button>
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

        {product.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {product.tags.map(t => (
              <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{t}</span>
            ))}
          </div>
        )}

        <div className="text-xs text-muted-foreground flex gap-3">
          <span>{typeof product.material === 'string' && !product.material.includes('[object') ? product.material : '—'}</span>
          <span>·</span>
          <span>{product.weightG}g</span>
          <span>·</span>
          <span>{product.printHours}h</span>
        </div>

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
  const [products, setProducts]       = useState<Product[]>([])
  const [loading, setLoading]         = useState(true)
  const [showForm, setShowForm]       = useState(false)
  const [editing, setEditing]         = useState<Product | null>(null)
  const [saving, setSaving]           = useState(false)
  const [search, setSearch]           = useState('')
  const [prefillProduct, setPrefill]  = useState<string | null>(null)
  const [prefillCost, setPrefillCost] = useState<number | null>(null)
  const testSectionRef                = useRef<HTMLDivElement>(null)

  async function load() {
    setLoading(true)
    try {
      const rows = await getProducts()
      setProducts((rows ?? []).map(r => fromRow(r as Record<string, unknown>)))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function handleRegisterTest(productName: string, productCost: number) {
    setPrefill(productName)
    setPrefillCost(productCost)
    setTimeout(() => testSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.material.toLowerCase().includes(search.toLowerCase()) ||
    p.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
  )

  const totalValue = products.reduce((s, p) => s + p.priceUSD, 0)
  const avgMargin  = products.length
    ? products.reduce((s, p) => s + margin(p.costUSD, p.priceUSD), 0) / products.length
    : 0

  async function save(data: Product) {
    setSaving(true)
    try {
      await upsertProduct({
        id:          data.id || undefined,
        name:        data.name,
        description: data.description,
        material:    data.material,
        weight_g:    data.weightG,
        print_hours: data.printHours,
        cost_usd:    data.costUSD,
        price_usd:   data.priceUSD,
        image_url:   data.imageUrl,
        tags:        data.tags,
      })
      await load()
    } finally {
      setSaving(false)
      setEditing(null)
      setShowForm(false)
    }
  }

  async function remove(id: string) {
    await deleteProduct(id)
    setProducts(prev => prev.filter(p => p.id !== id))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="size-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
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
              onDelete={() => remove(p.id)}
              onRegisterTest={() => handleRegisterTest(p.name, p.costUSD)}
            />
          ))}
        </div>
      )}

      {/* Test prints & waste */}
      <div ref={testSectionRef}>
        <TestPrintsSection
          prefillProduct={prefillProduct}
          prefillCost={prefillCost}
        />
      </div>

      {showForm && (
        <ProductForm
          initial={editing}
          onSave={save}
          onClose={() => { setShowForm(false); setEditing(null) }}
          saving={saving}
        />
      )}
    </div>
  )
}
