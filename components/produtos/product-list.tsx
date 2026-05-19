'use client'

import { useState, useEffect } from 'react'
import { Plus, Package, Pencil, Trash2, FlaskConical, XCircle, CheckCircle } from 'lucide-react'
import { ProductForm } from './product-form'
import { TestPrintsModal } from './test-prints-modal'
import { getProducts, upsertProduct, deleteProduct, setProductStatus } from '@/lib/actions/products'
import type { Product } from '@/lib/product-types'

// Map DB row (snake_case) → Product (camelCase)
function fromRow(row: Record<string, unknown>): Product {
  return {
    id:           String(row.id),
    name:         String(row.name),
    description:  String(row.description ?? ''),
    material:     String(row.material),
    weightG:      Number(row.weight_g),
    printHours:   Number(row.print_hours),
    costUSD:      Number(row.cost_usd),
    priceUSD:     Number(row.price_usd),
    imageUrl:     row.image_url ? String(row.image_url) : undefined,
    tags:         Array.isArray(row.tags) ? (row.tags as string[]) : [],
    createdAt:    String(row.created_at ?? ''),
    status:       (row.status as 'active' | 'failed') ?? 'active',
    volumePrices: Array.isArray(row.volume_prices)
      ? (row.volume_prices as { min_qty: number; price_usd: number }[]).map(t => ({
          minQty: t.min_qty, priceUSD: t.price_usd,
        }))
      : undefined,
    productCode:  row.product_code ? String(row.product_code) : undefined,
    unitsPerRun:  row.units_per_run ? Number(row.units_per_run) : 1,
    batches:      row.batches ? Number(row.batches) : undefined,
  }
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function margin(cost: number, price: number) {
  if (price === 0) return 0
  return ((price - cost) / price) * 100
}

type FilterStatus = 'all' | 'active' | 'failed' | 'test'

function ProductRow({ product, onEdit, onDelete, onRegisterTest, onToggleStatus }: {
  product: Product
  onEdit: () => void
  onDelete: () => void
  onRegisterTest: () => void
  onToggleStatus: () => void
}) {
  const m      = margin(product.costUSD, product.priceUSD)
  const profit = product.priceUSD - product.costUSD
  const isFailed = product.status === 'failed'
  const isTest   = product.status === 'test'
  const isDimmed = isFailed || isTest

  return (
    <div className={`group flex items-center gap-4 px-4 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${isDimmed ? 'opacity-60' : ''}`}>

      {/* Status indicator */}
      <div className="shrink-0">
        {isFailed ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded-full whitespace-nowrap">
            <XCircle className="size-2.5" /> Não aprovado
          </span>
        ) : isTest ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-orange-400 bg-orange-400/10 px-1.5 py-0.5 rounded-full whitespace-nowrap">
            <FlaskConical className="size-2.5" /> Teste
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded-full">
            <CheckCircle className="size-2.5" /> Ativo
          </span>
        )}
      </div>

      {/* Name + tags */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {product.productCode && (
            <span className="text-[10px] font-mono font-semibold text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded shrink-0">
              #{product.productCode}
            </span>
          )}
          <span className={`text-sm font-semibold truncate ${isFailed ? 'line-through text-muted-foreground' : ''}`}>
            {product.name}
          </span>
          {product.volumePrices?.length ? (
            <span className="text-[10px] text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded-full shrink-0">🏷️ volume</span>
          ) : null}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-muted-foreground">
            {product.material} · {product.weightG}g · {product.printHours}h
            {product.batches ? ` · ${product.batches} chapas` : ''}
            {(product.unitsPerRun ?? 1) > 1 ? ` · ${product.unitsPerRun} un/chapa` : ''}
          </span>
          {product.tags.slice(0, 2).map(t => (
            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{t}</span>
          ))}
        </div>
      </div>

      {/* Cost */}
      <div className="w-20 text-right shrink-0 hidden sm:block">
        <p className="text-[10px] text-muted-foreground uppercase">Custo</p>
        <p className="text-sm font-mono">{fmt(product.costUSD)}</p>
      </div>

      {/* Profit */}
      <div className="w-20 text-right shrink-0 hidden md:block">
        <p className="text-[10px] text-muted-foreground uppercase">Lucro</p>
        <p className="text-sm font-mono text-green-400">{fmt(profit)}</p>
      </div>

      {/* Price */}
      <div className="w-20 text-right shrink-0">
        <p className="text-[10px] text-muted-foreground uppercase">Preço</p>
        <p className="text-sm font-mono font-bold text-orange-500">{fmt(product.priceUSD)}</p>
      </div>

      {/* Margin bar */}
      <div className="w-16 shrink-0 hidden lg:block">
        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
          <span>Margem</span><span>{m.toFixed(0)}%</span>
        </div>
        <div className="h-1 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-orange-500 transition-all" style={{ width: `${Math.min(100, m)}%` }} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={onToggleStatus}
          title={isDimmed ? 'Marcar como ativo' : 'Marcar como não aprovado'}
          className={`p-1.5 rounded-md transition-colors ${
            isDimmed
              ? 'text-green-400 hover:bg-green-400/10'
              : 'text-muted-foreground hover:text-red-400 hover:bg-red-400/10'
          }`}
        >
          {isDimmed ? <CheckCircle className="size-3.5" /> : <XCircle className="size-3.5" />}
        </button>
        <button
          onClick={onRegisterTest}
          title="Registrar teste / perda"
          className="p-1.5 rounded-md text-muted-foreground hover:text-orange-400 hover:bg-orange-400/10 transition-colors"
        >
          <FlaskConical className="size-3.5" />
        </button>
        <button
          onClick={onEdit}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Pencil className="size-3.5" />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

type TestModalConfig = { prefillProduct?: string; prefillCost?: number } | null

export function ProductList() {
  const [products, setProducts]         = useState<Product[]>([])
  const [loading, setLoading]           = useState(true)
  const [showForm, setShowForm]         = useState(false)
  const [editing, setEditing]           = useState<Product | null>(null)
  const [saving, setSaving]             = useState(false)
  const [search, setSearch]             = useState('')
  const [filterStatus, setFilter]       = useState<FilterStatus>('active')
  const [testModalConfig, setTestModal] = useState<TestModalConfig>(null)

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
    setTestModal({ prefillProduct: productName, prefillCost: productCost })
  }

  async function handleToggleStatus(p: Product) {
    const next: 'active' | 'failed' | 'test' = (p.status === 'failed' || p.status === 'test') ? 'active' : 'failed'
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, status: next } : x))
    await setProductStatus(p.id, next)
  }

  const activeCount = products.filter(p => !p.status || p.status === 'active').length
  const failedCount = products.filter(p => p.status === 'failed').length
  const testCount   = products.filter(p => p.status === 'test').length

  const filtered = products
    .filter(p => {
      if (filterStatus === 'active') return !p.status || p.status === 'active'
      if (filterStatus === 'failed') return p.status === 'failed'
      if (filterStatus === 'test')   return p.status === 'test'
      return true
    })
    .filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.material.toLowerCase().includes(search.toLowerCase()) ||
      p.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
    )

  const activeProducts = products.filter(p => !p.status || p.status === 'active')
  const totalValue = activeProducts.reduce((s, p) => s + p.priceUSD, 0)
  const avgMargin  = activeProducts.length
    ? activeProducts.reduce((s, p) => s + margin(p.costUSD, p.priceUSD), 0) / activeProducts.length
    : 0

  async function save(data: Product) {
    setSaving(true)
    try {
      await upsertProduct({
        id:            data.id || undefined,
        name:          data.name,
        description:   data.description,
        material:      data.material,
        weight_g:      data.weightG,
        print_hours:   data.printHours,
        cost_usd:      data.costUSD,
        price_usd:     data.priceUSD,
        image_url:     data.imageUrl,
        tags:          data.tags,
        volume_prices: data.volumePrices?.map(t => ({ min_qty: t.minQty, price_usd: t.priceUSD })) ?? null,
        product_code:  data.productCode,
        units_per_run: data.unitsPerRun ?? 1,
        batches:       data.batches ?? null,
        status:        data.status ?? 'active',
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
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Produtos ativos', value: activeCount.toString() },
          { label: 'Valor do catálogo', value: fmt(totalValue) },
          { label: 'Margem média', value: `${avgMargin.toFixed(0)}%` },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-border bg-card px-5 py-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="search"
          placeholder="Buscar produtos…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-40 h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
        />

        {/* Status filter */}
        <div className="flex gap-1">
          {([
            { key: 'active', label: `Ativos (${activeCount})` },
            { key: 'test',   label: `Testes (${testCount})` },
            { key: 'failed', label: `Não aprovados (${failedCount})` },
            { key: 'all',    label: 'Todos' },
          ] as { key: FilterStatus; label: string }[]).map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                filterStatus === f.key
                  ? 'bg-orange-500 border-orange-500 text-white'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setTestModal({})}
          className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-md border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors whitespace-nowrap"
        >
          <FlaskConical className="size-4" /> Testes &amp; Perdas
        </button>

        <button
          onClick={() => { setEditing(null); setShowForm(true) }}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors whitespace-nowrap"
        >
          <Plus className="size-4" /> Adicionar produto
        </button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <Package className="size-8 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-sm text-muted-foreground">
            {search
              ? 'Nenhum produto encontrado.'
              : filterStatus === 'failed'
              ? 'Nenhum produto não aprovado.'
              : filterStatus === 'test'
              ? 'Nenhum produto de teste ainda.'
              : 'Nenhum produto ainda.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[120px_1fr_80px_80px_80px_80px_100px] gap-4 px-4 py-2.5 bg-muted/40 border-b border-border hidden lg:grid">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Status</span>
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Produto</span>
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-right">Custo</span>
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-right">Lucro</span>
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-right">Preço</span>
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Margem</span>
            <span />
          </div>

          {filtered.map(p => (
            <ProductRow
              key={p.id}
              product={p}
              onEdit={() => { setEditing(p); setShowForm(true) }}
              onDelete={() => remove(p.id)}
              onRegisterTest={() => handleRegisterTest(p.name, p.costUSD)}
              onToggleStatus={() => handleToggleStatus(p)}
            />
          ))}
        </div>
      )}

      {testModalConfig !== null && (
        <TestPrintsModal
          prefillProduct={testModalConfig.prefillProduct ?? null}
          prefillCost={testModalConfig.prefillCost ?? null}
          onClose={() => setTestModal(null)}
        />
      )}

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
