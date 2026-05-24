'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Info, Plus, X, Layers, RotateCcw, Palette, PackagePlus, Check, Trash2, Save, FolderOpen, Clock, Pencil } from 'lucide-react'
import { SlicerImport } from './slicer-import'
import { PrinterSelect, type SelectedPrinter } from './printer-select'
import { BambuImportModal } from './bambu-import-modal'
import type { SlicerData } from '@/lib/parse-gcode'
import type { BambuPrint } from '@/lib/actions/bambu'
import { useT } from '@/lib/i18n'
import { upsertProduct } from '@/lib/actions/products'
import { getAmortizationData, getTestPrints, getTestSettings } from '@/lib/actions/printers'
import { getFilaments } from '@/lib/actions/filaments'
import {
  getPricingSessions, savePricingSession, deletePricingSession, renamePricingSession,
  type SavedSession,
} from '@/lib/actions/pricing-sessions'

// ── Types ──────────────────────────────────────────────────────

interface CatalogFilament {
  id: string
  label: string       // display: "Bambu PLA Silk · Marine Blue"
  material: string
  colorHex: string
  priceUSD: number
  weightG: number
}

export interface BatchFilament {
  id: string
  catalogSpoolId?: string  // actual spool ID from filaments table (set when "Do estoque" is selected)
  weightG: number
  color: string        // hex
  type: string         // PLA / PETG / …
  spoolPriceUSD: number
  spoolWeightG: number
}

interface Batch {
  id: string
  name: string
  printHours: number
  filaments: BatchFilament[]
}

interface SharedValues {
  printerWatts: number
  electricityCost: number
  hourlyRate: number
  failureRate: number
  marginPct: number
  testOverheadRate: number
  // Defaults for new filaments
  defaultSpoolPrice: number
  defaultSpoolWeight: number
}

// ── Defaults ───────────────────────────────────────────────────

const DEFAULT_SHARED: SharedValues = {
  printerWatts:      120,
  electricityCost:   0.15,
  hourlyRate:        0.05,   // conservative default; auto-filled from printer lifespan when selected
  failureRate:       10,
  marginPct:         40,
  testOverheadRate:  0,
  defaultSpoolPrice: 20,
  defaultSpoolWeight: 1000,
}

function defaultFilament(overrides?: Partial<BatchFilament>): BatchFilament {
  return {
    id: crypto.randomUUID(),
    weightG: 50,
    color: '#888888',
    type: 'PLA',
    spoolPriceUSD: 20,
    spoolWeightG: 1000,
    ...overrides,
  }
}

function newBatch(): Batch {
  return { id: crypto.randomUUID(), name: '', printHours: 3, filaments: [defaultFilament()] }
}

// ── Calculation ────────────────────────────────────────────────

function calculate(batches: Batch[], s: SharedValues) {
  const totalWeight = batches.reduce(
    (sum, b) => sum + b.filaments.reduce((s2, f) => s2 + f.weightG, 0), 0)
  const totalHours = batches.reduce((sum, b) => sum + b.printHours, 0)

  const material = batches.reduce(
    (sum, b) => sum + b.filaments.reduce(
      (s2, f) => s2 + f.weightG * (f.spoolPriceUSD / Math.max(f.spoolWeightG, 1)), 0), 0)

  const energy     = (totalHours * s.printerWatts / 1000) * s.electricityCost
  const machine    = totalHours * s.hourlyRate
  const testWaste  = totalHours * s.testOverheadRate
  const subtotal   = (material + energy + machine + testWaste) * (1 + s.failureRate / 100)
  const salePrice  = s.marginPct >= 100 ? subtotal * 2 : subtotal / (1 - s.marginPct / 100)
  const profit     = salePrice - subtotal

  return { material, energy, machine, testWaste, subtotal, salePrice, profit, totalWeight, totalHours }
}

// ── Multi-unit / kit pricing ────────────────────────────────────
// material cost scales per unit; energy+machine+waste scale per run (ceil(qty/unitsPerRun))
function calculateForQty(
  qty: number,
  base: ReturnType<typeof calculate>,
  s: SharedValues,
  unitsPerRun: number,
  marginOverride?: number | null,
) {
  const runs       = Math.ceil(qty / Math.max(1, unitsPerRun))
  const rawMat     = base.material * qty
  const rawFixed   = (base.energy + base.machine + base.testWaste) * runs
  const subtotal   = (rawMat + rawFixed) * (1 + s.failureRate / 100)
  const mPct       = marginOverride ?? s.marginPct
  const totalPrice = mPct >= 100 ? subtotal * 2 : subtotal / (1 - mPct / 100)
  const unitPrice  = totalPrice / qty
  return { unitPrice, totalPrice, subtotal, runs }
}

// ── Formatting ─────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function pct(part: number, total: number) {
  if (total === 0) return '0%'
  return `${((part / total) * 100).toFixed(0)}%`
}

// ── Shared field config ─────────────────────────────────────────

interface Field { id: keyof SharedValues; label: string; unit: string; min: number; step: number; tip: string }

const SHARED_FIELDS: Field[] = [
  { id: 'printerWatts',      label: 'Printer power',          unit: 'W',    min: 10,   step: 5,     tip: 'Average wattage. Bambu A1 ≈ 120W during printing.' },
  { id: 'electricityCost',   label: 'Electricity cost',       unit: '$/kWh',min: 0.01, step: 0.01,  tip: 'Your electricity rate per kilowatt-hour.' },
  { id: 'hourlyRate',        label: 'Equipment amortization', unit: '$/h',  min: 0,    step: 0.001, tip: 'Auto-filled from equipment value ÷ lifespan when you select a printer.' },
  { id: 'failureRate',       label: 'Failure / waste',        unit: '%',    min: 0,    step: 1,     tip: 'Buffer for failed prints and material waste.' },
  { id: 'marginPct',         label: 'Profit margin',          unit: '%',    min: 0,    step: 5,     tip: 'Your desired profit margin on top of all costs.' },
  { id: 'testOverheadRate',  label: 'Test overhead',          unit: '$/h',  min: 0,    step: 0.001, tip: 'Waste cost spread across production hours. Auto-filled from test print logs in Equipment.' },
]

const SPOOL_DEFAULTS: Field[] = [
  { id: 'defaultSpoolPrice',  label: 'Default spool price',  unit: '$',  min: 0.01, step: 0.5, tip: 'Default price used when adding a new filament.' },
  { id: 'defaultSpoolWeight', label: 'Default spool weight', unit: 'g',  min: 100,  step: 50,  tip: 'Default spool weight in grams (usually 1000 g).' },
]

// ── SaveProductModal ────────────────────────────────────────────

function SaveProductModal({
  costUSD,
  priceUSD,
  weightG,
  printHours,
  material,
  unitsPerRun,
  batchCount,
  sessionId,
  onClose,
}: {
  costUSD: number
  priceUSD: number
  weightG: number
  printHours: number
  material: string
  unitsPerRun: number
  batchCount: number
  sessionId?: string | null
  onClose: () => void
}) {
  const { t } = useT()
  const pr = t.pricing
  const [name, setName]       = useState('')
  const [mat, setMat]         = useState(material || 'PLA')
  const [cost, setCost]       = useState(parseFloat(costUSD.toFixed(2)))
  const [price, setPrice]     = useState(parseFloat(priceUSD.toFixed(2)))
  const [priceStr, setPriceStr] = useState(priceUSD > 0 ? priceUSD.toFixed(2) : '')
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      await upsertProduct({
        name: name.trim(),
        material: mat,
        weight_g: parseFloat(weightG.toFixed(1)),
        print_hours: parseFloat(printHours.toFixed(2)),
        cost_usd: cost,
        price_usd: price,
        tags: [],
        units_per_run: unitsPerRun,
        batches: batchCount > 1 ? batchCount : undefined,
        pricing_session_id: sessionId ?? null,
      })
      setSaved(true)
      setTimeout(onClose, 1200)
    } catch {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <form
        onSubmit={submit}
        className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-background shadow-2xl p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <PackagePlus className="size-4 text-blue-600" />
            {pr.saveAsProductTitle}
          </h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-3">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">{pr.productName} *</label>
            <Input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Happy Birthday Nameplate"
              required
            />
          </div>

          {/* Material */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">{pr.productMaterial}</label>
            <Input value={mat} onChange={e => setMat(e.target.value)} placeholder="PLA" />
          </div>

          {/* Cost + Price side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">{t.products.costUSD}</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">$</span>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={cost.toFixed(2)}
                  readOnly
                  className="pl-6 text-muted-foreground cursor-default select-none"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">{t.products.priceUSD}</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">$</span>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={priceStr}
                  onChange={e => {
                    const raw = e.target.value.replace(/[^0-9.]/g, '')
                    setPriceStr(raw)
                    const n = parseFloat(raw)
                    if (!isNaN(n) && n > 0) setPrice(n)
                  }}
                  onBlur={() => {
                    const n = parseFloat(priceStr)
                    if (!isNaN(n) && n > 0) {
                      setPrice(n)
                      setPriceStr(n.toFixed(2))
                    } else {
                      setPriceStr('')
                      setPrice(0)
                    }
                  }}
                  className="pl-6"
                />
              </div>
            </div>
          </div>

          {/* Summary chips */}
          <div className="flex gap-2 text-xs text-muted-foreground">
            <span className="bg-muted/50 rounded-full px-2 py-0.5">{weightG.toFixed(1)}g</span>
            <span className="bg-muted/50 rounded-full px-2 py-0.5">{printHours.toFixed(2)}h</span>
            {price > 0 && cost > 0 && (
              <span className="bg-blue-600/10 text-blue-500 rounded-full px-2 py-0.5">
                {(((price - cost) / price) * 100).toFixed(1)}% margin
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 rounded-md border border-border py-2 text-sm hover:bg-muted transition-colors">
            {t.common.cancel}
          </button>
          <button type="submit" disabled={saving || saved || !name.trim()}
            className="flex-1 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2">
            {saved
              ? <><Check className="size-4" /> {pr.productSaved}</>
              : saving
                ? pr.productSaving
                : pr.saveAsProduct}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── NumInput ───────────────────────────────────────────────────

function NumInput({ id, label, unit, value, min, step, tip, onChange, compact }: {
  id: string; label: string; unit: string; value: number
  min: number; step: number; tip: string; onChange: (v: number) => void
  compact?: boolean
}) {
  const isPercent      = unit === '%'
  const isDollarPrefix = unit === '$'

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground flex items-center gap-1">
        {label}
        {!compact && (
          <span className="group relative">
            <Info className="size-3 opacity-40 cursor-help" />
            <span className="absolute left-4 -top-1 z-10 hidden group-hover:block w-52 rounded-md border border-border bg-popover text-popover-foreground text-xs p-2 shadow-md">
              {tip}
            </span>
          </span>
        )}
      </Label>
      <div className="relative flex items-center">
        {isDollarPrefix && (
          <span className="absolute left-3 text-xs text-muted-foreground pointer-events-none">$</span>
        )}
        <Input
          id={id}
          type="number"
          min={min}
          step={step}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className={`h-8 text-sm ${isDollarPrefix ? 'pl-6' : ''} ${isPercent ? 'pr-7' : ''}`}
        />
        {(isPercent || (!isDollarPrefix && unit !== '$')) && (
          <span className="absolute right-3 text-xs text-muted-foreground pointer-events-none">
            {unit}
          </span>
        )}
      </div>
    </div>
  )
}

// ── CostRow ────────────────────────────────────────────────────

function CostRow({ label, value, total, accent = false }: { label: string; value: number; total: number; accent?: boolean }) {
  const width = total > 0 ? Math.max(2, (value / total) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className={accent ? 'font-medium' : 'text-muted-foreground'}>{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{pct(value, total)}</span>
          <span className={accent ? 'font-semibold' : ''}>{fmt(value)}</span>
        </div>
      </div>
      <div className="h-1 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${accent ? 'bg-blue-600' : 'bg-muted-foreground/40'}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  )
}

// ── FilamentRow ────────────────────────────────────────────────

function FilamentRow({
  filament,
  canRemove,
  catalog,
  onUpdate,
  onRemove,
}: {
  filament: BatchFilament
  canRemove: boolean
  catalog: CatalogFilament[]
  onUpdate: (id: string, field: keyof BatchFilament, value: string | number) => void
  onRemove: (id: string) => void
}) {
  function applyFromCatalog(catId: string) {
    const cat = catalog.find(c => c.id === catId)
    if (!cat) return
    onUpdate(filament.id, 'catalogSpoolId', catId)   // save the actual spool ID for deduction
    onUpdate(filament.id, 'type',           cat.material)
    onUpdate(filament.id, 'color',          cat.colorHex)
    onUpdate(filament.id, 'spoolPriceUSD',  cat.priceUSD)
    onUpdate(filament.id, 'spoolWeightG',   cat.weightG)
  }

  return (
    <div className="rounded-md bg-muted/30 border border-border/50 p-2 space-y-2">
      {/* Catalog picker row */}
      {catalog.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground shrink-0">Do estoque:</span>
          <select
            defaultValue=""
            onChange={e => { if (e.target.value) applyFromCatalog(e.target.value) }}
            className="flex-1 h-6 text-[11px] rounded border border-border/60 bg-background px-1.5 outline-none focus:border-blue-600 transition-colors"
          >
            <option value="">— selecionar filamento —</option>
            {catalog.map(c => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
      )}
      {/* Fields row */}
      <div className="flex items-end gap-2">
      {/* Color dot + picker */}
      <div className="shrink-0 flex flex-col items-center gap-1">
        <label className="cursor-pointer" title="Pick color">
          <span
            className="block size-6 rounded-full border-2 border-border"
            style={{ backgroundColor: filament.color }}
          />
          <input
            type="color"
            value={filament.color}
            onChange={e => onUpdate(filament.id, 'color', e.target.value)}
            className="sr-only"
          />
        </label>
        <span className="text-[9px] text-muted-foreground font-mono">{filament.type}</span>
      </div>

      {/* Weight */}
      <div className="flex-1 space-y-1">
        <Label className="text-[10px] text-muted-foreground">Weight (g)</Label>
        <Input
          type="number" min={0} step={1}
          value={filament.weightG}
          onChange={e => onUpdate(filament.id, 'weightG', parseFloat(e.target.value) || 0)}
          className="h-7 text-xs"
        />
      </div>

      {/* Spool price */}
      <div className="flex-1 space-y-1">
        <Label className="text-[10px] text-muted-foreground">Spool $</Label>
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">$</span>
          <Input
            type="number" min={0.01} step={0.5}
            value={filament.spoolPriceUSD}
            onChange={e => onUpdate(filament.id, 'spoolPriceUSD', parseFloat(e.target.value) || 0)}
            className="h-7 text-xs pl-4"
          />
        </div>
      </div>

      {/* Spool weight */}
      <div className="w-16 space-y-1">
        <Label className="text-[10px] text-muted-foreground">Spool g</Label>
        <Input
          type="number" min={100} step={50}
          value={filament.spoolWeightG}
          onChange={e => onUpdate(filament.id, 'spoolWeightG', parseFloat(e.target.value) || 1000)}
          className="h-7 text-xs"
        />
      </div>

      {/* Remove */}
      {canRemove && (
        <button
          onClick={() => onRemove(filament.id)}
          className="shrink-0 mb-0.5 rounded p-1 text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors"
        >
          <X className="size-3" />
        </button>
      )}
      </div>{/* end fields row */}
    </div>
  )
}

// ── BatchRow ───────────────────────────────────────────────────

function BatchRow({
  batch,
  index,
  canRemoveBatch,
  onUpdateBatch,
  onRemoveBatch,
  onUpdateFilament,
  onRemoveFilament,
  onAddFilament,
  onImportFilaments,
  onBambuImport,
  platLabel,
  importFileLabel,
  defaultSpoolPrice,
  defaultSpoolWeight,
  catalog,
}: {
  batch: Batch
  index: number
  canRemoveBatch: boolean
  onUpdateBatch: (id: string, field: 'name' | 'printHours', value: string | number) => void
  onRemoveBatch: (id: string) => void
  onUpdateFilament: (batchId: string, filamentId: string, field: keyof BatchFilament, value: string | number) => void
  onRemoveFilament: (batchId: string, filamentId: string) => void
  onAddFilament: (batchId: string) => void
  onImportFilaments: (batchId: string, filaments: NonNullable<SlicerData['filaments']>) => void
  onBambuImport: (batchId: string) => void
  platLabel: string
  importFileLabel: string
  defaultSpoolPrice: number
  defaultSpoolWeight: number
  catalog: CatalogFilament[]
}) {
  const totalWeight = batch.filaments.reduce((s, f) => s + f.weightG, 0)
  const isMultiColor = batch.filaments.length > 1

  const handleImport = useCallback((data: SlicerData) => {
    if (data.printHours !== undefined) onUpdateBatch(batch.id, 'printHours', data.printHours)

    if (data.filaments && data.filaments.length > 1) {
      // Multi-filament: replace filaments array in parent
      onImportFilaments(batch.id, data.filaments)
    } else if (data.weightG !== undefined) {
      // Single filament — update first filament weight
      onUpdateFilament(batch.id, batch.filaments[0].id, 'weightG', data.weightG)
    }
  }, [batch.id, batch.filaments, onUpdateBatch, onUpdateFilament, onImportFilaments])

  return (
    <div className="rounded-lg border border-border bg-card/50 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground shrink-0">
          <Layers className="size-3.5 text-blue-600/70" />
          {platLabel} {index + 1}
        </div>
        <Input
          value={batch.name}
          onChange={e => onUpdateBatch(batch.id, 'name', e.target.value)}
          placeholder={`${platLabel} ${index + 1}`}
          className="h-7 text-xs flex-1"
        />
        {canRemoveBatch && (
          <button
            onClick={() => onRemoveBatch(batch.id)}
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* Print time */}
      <div className="flex items-end gap-3">
        <div className="w-32 space-y-1.5">
          <Label className="text-xs text-muted-foreground">Print time (h)</Label>
          <Input
            type="number" min={0.1} step={0.25}
            value={batch.printHours}
            onChange={e => onUpdateBatch(batch.id, 'printHours', parseFloat(e.target.value) || 0)}
            className="h-8 text-sm"
          />
        </div>

        {/* Summary chips */}
        <div className="flex gap-1.5 flex-wrap pb-0.5">
          {batch.filaments.map(f => (
            <span
              key={f.id}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/40 rounded-full px-2 py-0.5"
            >
              <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: f.color }} />
              {f.weightG}g
            </span>
          ))}
          {isMultiColor && (
            <span className="text-xs text-muted-foreground bg-muted/40 rounded-full px-2 py-0.5">
              = {totalWeight.toFixed(1)}g total
            </span>
          )}
        </div>
      </div>

      {/* Filament rows */}
      <div className="space-y-1.5">
        {batch.filaments.map(f => (
          <FilamentRow
            key={f.id}
            filament={f}
            canRemove={batch.filaments.length > 1}
            catalog={catalog}
            onUpdate={(fid, field, val) => onUpdateFilament(batch.id, fid, field, val)}
            onRemove={fid => onRemoveFilament(batch.id, fid)}
          />
        ))}
      </div>

      {/* Add color + imports */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => onAddFilament(batch.id)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border hover:border-blue-600/40 rounded-md px-2 py-1 transition-colors"
        >
          <Palette className="size-3" />
          + cor
        </button>
        <div className="flex-1">
          <SlicerImport onImport={handleImport} compact label={importFileLabel} />
        </div>
        {/* Bambu import */}
        <button
          onClick={() => onBambuImport(batch.id)}
          className="flex items-center gap-1.5 text-xs text-green-500 hover:text-green-600 border border-dashed border-green-500/30 hover:border-green-500/60 rounded-md px-2 py-1 transition-colors"
          title="Importar do Bambu Cloud"
        >
          <svg className="size-3" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L4 6v12l8 4 8-4V6L12 2z" fill="#00AE42" />
          </svg>
          Bambu
        </button>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────

export function PricingCalculator() {
  const { t, fmtCurrency } = useT()
  const pr = t.pricing
  const searchParams = useSearchParams()

  const [shared, setShared]         = useState<SharedValues>(DEFAULT_SHARED)
  const [batches, setBatches]       = useState<Batch[]>([newBatch()])
  const [printerId, setPrinterId]   = useState('')
  const [amortLabel, setAmortLabel] = useState<string | null>(null)
  const [priceOverride, setPriceOverride] = useState<number | null>(null)
  const [priceInput, setPriceInput]       = useState('')
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [bambuTargetBatch, setBambuTargetBatch] = useState<string | null>(null)
  const [catalogFilaments, setCatalogFilaments] = useState<CatalogFilament[]>([])

  // ── Kit / quantity table ────────────────────────────────────
  const [unitsPerRun,    setUnitsPerRun]    = useState(1)
  const [quantityTiers,  setQuantityTiers]  = useState<number[]>([1, 3, 5, 10])
  const [newTierInput,   setNewTierInput]   = useState('')

  // ── Saved sessions ─────────────────────────────────────────
  const [sessions,        setSessions]       = useState<SavedSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [showSessions,    setShowSessions]   = useState(false)
  const [savingSession,   setSavingSession]  = useState(false)
  const [sessionName,     setSessionName]    = useState('')
  const [editingName,     setEditingName]    = useState(false)
  const autoLoadedRef = useRef(false)

  // ── Auto-load test overhead + filament catalog on mount ───
  useEffect(() => {
    async function loadData() {
      try {
        const [amort, tests, testSettings, filamentRows, savedSessions] = await Promise.all([
          getAmortizationData(),
          getTestPrints(),
          getTestSettings(),
          getFilaments(),
          getPricingSessions(),
        ])
        setSessions(savedSessions)

        // Auto-load session from URL param ?session=<id> (opened from product page)
        const sessionParam = searchParams.get('session')
        if (sessionParam && !autoLoadedRef.current) {
          autoLoadedRef.current = true
          const target = savedSessions.find(s => s.id === sessionParam)
          if (target) {
            setBatches((target.batches as Batch[]).map(b => ({ ...b, id: b.id || crypto.randomUUID() })))
            setShared(target.shared as SharedValues)
            setPriceOverride(target.price_override)
            setPriceInput(target.price_override ? target.price_override.toFixed(2) : '')
            setUnitsPerRun(target.units_per_run ?? 1)
            setQuantityTiers(Array.isArray(target.quantity_tiers) ? target.quantity_tiers : [1, 3, 5, 10])
            setActiveSessionId(target.id)
            setSessionName(target.name)
          }
        }
        const totalCost = tests.reduce((s: number, t: { amount: number }) => s + t.amount, 0)
        if (totalCost > 0) {
          // Use user-defined payback period if set, otherwise fall back to product hours
          const targetHours = (testSettings.months && testSettings.hoursPerDay)
            ? testSettings.months * 30 * testSettings.hoursPerDay
            : amort.totalProductHours
          if (targetHours > 0) {
            const rate = totalCost / targetHours
            setShared(prev => ({ ...prev, testOverheadRate: parseFloat(rate.toFixed(4)) }))
          }
        }
        // Map filament rows to a simple catalog shape
        const catalog: CatalogFilament[] = (filamentRows ?? [])
          .filter((f: Record<string, unknown>) => Number(f.remaining_g ?? f.weight_g ?? 0) > 0)
          .map((f: Record<string, unknown>) => ({
            id:           String(f.id),
            label:        `${f.brand} ${f.material} · ${f.color}`,
            material:     String(f.material ?? 'PLA'),
            colorHex:     String(f.color_hex ?? '#888888'),
            priceUSD:     Number(f.price_usd ?? 0),
            weightG:      Number(f.weight_g ?? 1000),
          }))
        setCatalogFilaments(catalog)
      } catch {
        // silently ignore
      }
    }
    loadData()
  }, [])

  // ── Shared setters ─────────────────────────────────────────
  const setSharedField = (id: keyof SharedValues) => (v: number) => {
    setShared(prev => ({ ...prev, [id]: v }))
    if (id === 'marginPct') setPriceOverride(null)
  }

  const handlePrinter = useCallback((printer: SelectedPrinter) => {
    setPrinterId(printer.id)
    setShared(prev => ({
      ...prev,
      printerWatts: printer.watts,
      ...(printer.hourlyRate != null ? { hourlyRate: parseFloat(printer.hourlyRate.toFixed(4)) } : {}),
    }))
    setAmortLabel(printer.hourlyRate != null ? printer.label : null)
  }, [])

  // ── Batch operations ───────────────────────────────────────
  const addBatch = () => setBatches(prev => [...prev, newBatch()])
  const removeBatch = (id: string) => setBatches(prev => prev.filter(b => b.id !== id))

  const updateBatch = useCallback((id: string, field: 'name' | 'printHours', value: string | number) => {
    setBatches(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b))
  }, [])

  // ── Filament operations ────────────────────────────────────
  const updateFilament = useCallback((batchId: string, filamentId: string, field: keyof BatchFilament, value: string | number) => {
    setBatches(prev => prev.map(b => {
      if (b.id !== batchId) return b
      return { ...b, filaments: b.filaments.map(f => f.id === filamentId ? { ...f, [field]: value } : f) }
    }))
  }, [])

  const removeFilament = useCallback((batchId: string, filamentId: string) => {
    setBatches(prev => prev.map(b => {
      if (b.id !== batchId) return b
      return { ...b, filaments: b.filaments.filter(f => f.id !== filamentId) }
    }))
  }, [])

  const addFilament = useCallback((batchId: string) => {
    setBatches(prev => prev.map(b => {
      if (b.id !== batchId) return b
      return {
        ...b,
        filaments: [...b.filaments, defaultFilament({
          spoolPriceUSD: shared.defaultSpoolPrice,
          spoolWeightG: shared.defaultSpoolWeight,
        })]
      }
    }))
  }, [shared.defaultSpoolPrice, shared.defaultSpoolWeight])

  // ── Multi-filament import (from gcode) ────────────────────
  const importFilaments = useCallback((batchId: string, filaments: NonNullable<SlicerData['filaments']>) => {
    setBatches(prev => prev.map(b => {
      if (b.id !== batchId) return b
      return {
        ...b,
        filaments: filaments.map(f => defaultFilament({
          weightG: f.weightG,
          color: f.color,
          type: f.type,
          spoolPriceUSD: f.costPerSpool,
          spoolWeightG: shared.defaultSpoolWeight,
        }))
      }
    }))
  }, [shared.defaultSpoolWeight])

  // ── Bambu import handler ───────────────────────────────────
  const handleBambuSelect = useCallback((print: BambuPrint) => {
    if (!bambuTargetBatch) return
    setBatches(prev => prev.map(b => {
      if (b.id !== bambuTargetBatch) return b
      return {
        ...b,
        name: b.name || print.plateName || print.title.slice(0, 30),
        printHours: print.printHours,
        filaments: [defaultFilament({
          weightG: print.weightG,
          type: print.material,
          spoolPriceUSD: shared.defaultSpoolPrice,
          spoolWeightG: shared.defaultSpoolWeight,
        })],
      }
    }))
    setBambuTargetBatch(null)
  }, [bambuTargetBatch, shared.defaultSpoolPrice, shared.defaultSpoolWeight])

  // ── Session save / load ────────────────────────────────────
  async function handleSaveSession() {
    setSavingSession(true)
    try {
      const name = sessionName.trim() || `Cálculo ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
      const saved = await savePricingSession({
        id:            activeSessionId ?? undefined,
        name,
        batches,
        shared,
        price_override: priceOverride,
        units_per_run:  unitsPerRun,
        quantity_tiers: quantityTiers,
        result_cost:    result.subtotal,
        result_price:   priceOverride ?? result.salePrice,
      })
      if (saved) {
        setActiveSessionId(saved.id)
        setSessionName(saved.name)
        setSessions(prev => {
          const exists = prev.find(s => s.id === saved.id)
          return exists
            ? prev.map(s => s.id === saved.id ? saved : s)
            : [saved, ...prev]
        })
        setEditingName(false)
      }
    } finally {
      setSavingSession(false)
    }
  }

  function handleLoadSession(s: SavedSession) {
    setBatches((s.batches as Batch[]).map(b => ({ ...b, id: b.id || crypto.randomUUID() })))
    setShared(s.shared as SharedValues)
    setPriceOverride(s.price_override)
    setPriceInput(s.price_override ? s.price_override.toFixed(2) : '')
    setUnitsPerRun(s.units_per_run ?? 1)
    setQuantityTiers(Array.isArray(s.quantity_tiers) ? s.quantity_tiers : [1, 3, 5, 10])
    setActiveSessionId(s.id)
    setSessionName(s.name)
    setShowSessions(false)
  }

  async function handleDeleteSession(id: string) {
    await deletePricingSession(id)
    setSessions(prev => prev.filter(s => s.id !== id))
    if (activeSessionId === id) {
      setActiveSessionId(null)
      setSessionName('')
    }
  }

  async function handleRenameSession(id: string, name: string) {
    await renamePricingSession(id, name)
    setSessions(prev => prev.map(s => s.id === id ? { ...s, name } : s))
    if (activeSessionId === id) setSessionName(name)
    setEditingName(false)
  }

  // ── Calculation ────────────────────────────────────────────
  const result = useMemo(() => calculate(batches, shared), [batches, shared])

  const finalPrice   = priceOverride ?? result.salePrice
  const finalProfit  = finalPrice - result.subtotal
  const effectivePct = finalPrice > 0 ? (finalProfit / finalPrice) * 100 : 0
  const isOverridden = priceOverride !== null

  return (
    <div className="space-y-4">

      {/* ── Session toolbar ──────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Current session name */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {editingName ? (
            <input
              autoFocus
              value={sessionName}
              onChange={e => setSessionName(e.target.value)}
              onBlur={() => {
                if (activeSessionId && sessionName.trim()) handleRenameSession(activeSessionId, sessionName.trim())
                else setEditingName(false)
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && activeSessionId && sessionName.trim()) handleRenameSession(activeSessionId, sessionName.trim())
                if (e.key === 'Escape') setEditingName(false)
              }}
              className="h-7 rounded-md border border-blue-600 bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 min-w-0 flex-1 max-w-xs"
            />
          ) : (
            <button onClick={() => setEditingName(true)} title="Clique para renomear"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors truncate max-w-xs">
              <span className="truncate">{sessionName || 'Cálculo sem nome'}</span>
              {activeSessionId && <Pencil className="size-3 shrink-0 opacity-50" />}
            </button>
          )}
        </div>

        {/* Saved sessions dropdown */}
        <div className="relative">
          <button onClick={() => setShowSessions(v => !v)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md px-2.5 h-7 transition-colors">
            <FolderOpen className="size-3.5" />
            Salvos
            {sessions.length > 0 && (
              <span className="bg-blue-600 text-white text-[10px] rounded-full px-1.5 leading-4 font-medium">
                {sessions.length}
              </span>
            )}
          </button>

          {showSessions && (
            <>
              {/* backdrop */}
              <div className="fixed inset-0 z-40" onClick={() => setShowSessions(false)} />
              <div className="absolute left-0 top-8 z-50 w-72 rounded-xl border border-border bg-background shadow-2xl overflow-hidden">
                <div className="px-3 py-2 border-b border-border bg-muted/30">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cálculos salvos</p>
                </div>
                {sessions.length === 0 ? (
                  <p className="px-4 py-6 text-xs text-muted-foreground text-center">Nenhum cálculo salvo ainda.</p>
                ) : (
                  <div className="max-h-64 overflow-y-auto divide-y divide-border">
                    {sessions.map(s => (
                      <div key={s.id} className="flex items-center gap-2 px-3 py-2.5 hover:bg-muted/40 transition-colors group">
                        <button onClick={() => handleLoadSession(s)} className="flex-1 text-left min-w-0">
                          <p className={`text-xs font-medium truncate ${s.id === activeSessionId ? 'text-blue-600' : ''}`}>{s.name}</p>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                            <Clock className="size-2.5" />
                            {new Date(s.updated_at).toLocaleDateString()}
                            {s.result_price != null && (
                              <span className="text-blue-500 font-mono">
                                · {fmtCurrency(Number(s.result_price))}
                              </span>
                            )}
                          </div>
                        </button>
                        <button onClick={() => handleDeleteSession(s.id)}
                          className="p-1 rounded text-muted-foreground hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="px-3 py-2 border-t border-border">
                  <button
                    onClick={() => {
                      setBatches([newBatch()])
                      setShared(DEFAULT_SHARED)
                      setPriceOverride(null)
                      setPriceInput('')
                      setUnitsPerRun(1)
                      setQuantityTiers([1, 3, 5, 10])
                      setActiveSessionId(null)
                      setSessionName('')
                      setShowSessions(false)
                    }}
                    className="w-full text-xs text-muted-foreground hover:text-foreground py-1 transition-colors"
                  >
                    + Novo cálculo em branco
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Save button */}
        <button onClick={handleSaveSession} disabled={savingSession}
          className="flex items-center gap-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 h-7 rounded-md transition-colors">
          <Save className="size-3.5" />
          {savingSession ? 'Salvando…' : activeSessionId ? 'Atualizar' : 'Salvar cálculo'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── Left: inputs ──────────────────────────────────── */}
        <div className="lg:col-span-3 space-y-4">

          {/* ── Unidades por chapa ── */}
          <div className="flex items-center gap-4 rounded-xl border border-blue-600/30 bg-blue-600/5 px-5 py-3.5">
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Unidades produzidas por chapa</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Quantas peças saem de uma vez nesta configuração de impressão
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <input
                type="number" min={1} step={1}
                value={unitsPerRun}
                onChange={e => setUnitsPerRun(Math.max(1, +e.target.value))}
                className="w-16 h-9 rounded-md border border-blue-600/40 bg-background px-2 text-center text-lg font-bold text-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-sm text-muted-foreground">un/chapa</span>
            </div>
          </div>

          {/* Build plates */}
          <Card>
            <CardHeader className="pb-3 pt-4 px-5">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                {pr.batches}
                <Badge variant="secondary" className="text-xs font-mono normal-case">
                  {batches.length} {batches.length === 1 ? pr.plate : pr.batches.toLowerCase()}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-3">
              {batches.map((batch, i) => (
                <BatchRow
                  key={batch.id}
                  batch={batch}
                  index={i}
                  canRemoveBatch={batches.length > 1}
                  onUpdateBatch={updateBatch}
                  onRemoveBatch={removeBatch}
                  onUpdateFilament={updateFilament}
                  onRemoveFilament={removeFilament}
                  onAddFilament={addFilament}
                  onImportFilaments={importFilaments}
                  onBambuImport={id => setBambuTargetBatch(id)}
                  platLabel={pr.plate}
                  importFileLabel={pr.importFile}
                  defaultSpoolPrice={shared.defaultSpoolPrice}
                  defaultSpoolWeight={shared.defaultSpoolWeight}
                  catalog={catalogFilaments}
                />
              ))}
              <Button
                variant="outline" size="sm"
                onClick={addBatch}
                className="w-full border-dashed text-muted-foreground hover:text-foreground"
              >
                <Plus className="size-3.5 mr-1" />
                {pr.addBatch}
              </Button>

              {batches.length > 1 && (
                <div className="flex gap-4 pt-1 text-xs text-muted-foreground border-t border-border">
                  <span>{pr.totalWeight}: <span className="font-medium text-foreground">{result.totalWeight.toFixed(1)}g</span></span>
                  <span>{pr.totalTime}: <span className="font-medium text-foreground">{result.totalHours.toFixed(2)}h</span></span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Shared settings */}
          <Card>
            <CardHeader className="pb-3 pt-4 px-5">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{pr.sharedSettings}</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-4">
              {/* Default spool */}
              <div className="grid grid-cols-2 gap-4">
                {SPOOL_DEFAULTS.map(f => (
                  <NumInput key={f.id} id={f.id} label={f.label} unit={f.unit}
                    value={shared[f.id]} min={f.min} step={f.step} tip={f.tip}
                    onChange={setSharedField(f.id)} />
                ))}
              </div>

              <Separator />

              {/* Printer */}
              <PrinterSelect value={printerId} onChange={handlePrinter} />

              {/* Energy + other */}
              <div className="grid grid-cols-2 gap-4">
                {SHARED_FIELDS.slice(0, 2).map(f => (
                  <NumInput key={f.id} id={f.id} label={f.label} unit={f.unit}
                    value={shared[f.id]} min={f.min} step={f.step} tip={f.tip}
                    onChange={setSharedField(f.id)} />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Margin & Overhead */}
          <Card>
            <CardHeader className="pb-3 pt-4 px-5">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{pr.marginOverhead}</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                {SHARED_FIELDS.slice(2).map(f => (
                  <NumInput key={f.id} id={f.id} label={f.label} unit={f.unit}
                    value={shared[f.id]} min={f.min} step={f.step} tip={f.tip}
                    onChange={setSharedField(f.id)} />
                ))}
              </div>
              {amortLabel ? (
                <p className="text-xs text-blue-500/80 flex items-center gap-1">
                  <span className="inline-block size-1.5 rounded-full bg-blue-500" />
                  {pr.amortFrom} <span className="font-medium">{amortLabel}</span>
                </p>
              ) : (
                <p className="text-xs text-yellow-500/80 flex items-center gap-1.5">
                  <span className="inline-block size-1.5 rounded-full bg-yellow-500/60" />
                  Nenhuma impressora selecionada — valor manual. Para calcular automaticamente, cadastre e selecione sua impressora acima.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Right: result panel ────────────────────────────── */}
        <div className="lg:col-span-2">
          <Card className="sticky top-4">
            <CardHeader className="pb-3 pt-4 px-5">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{pr.costBreakdown}</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-3">
              <CostRow label={pr.filament}    value={result.material}   total={result.subtotal} />
              <CostRow label={pr.timeEnergy} value={result.energy}    total={result.subtotal} />
              <CostRow label={pr.equipAmort} value={result.machine}   total={result.subtotal} />
              {result.testWaste > 0 && (
                <CostRow label={pr.testOverhead} value={result.testWaste} total={result.subtotal} />
              )}

              <Separator />

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{pr.totalCost}</span>
                <span>{fmt(result.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className={isOverridden ? 'text-blue-500' : 'text-muted-foreground'}>
                  {pr.profit}{' '}
                  <span className={`font-semibold ${effectivePct < 0 ? 'text-red-400' : isOverridden ? 'text-blue-500' : ''}`}>
                    ({effectivePct.toFixed(1)}%)
                  </span>
                  {isOverridden && (
                    <span className="text-xs text-muted-foreground ml-1">· {pr.effectiveMargin}</span>
                  )}
                </span>
                <span className={`font-medium ${finalProfit < 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {fmt(finalProfit)}
                </span>
              </div>

              <Separator />

              {/* Editable price hero */}
              <div className={`rounded-xl border p-4 text-center transition-colors ${
                isOverridden ? 'bg-blue-600/15 border-blue-600/40' : 'bg-blue-600/10 border-blue-600/20'
              }`}>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <p className="text-xs text-blue-500 font-mono uppercase tracking-wider">
                    {isOverridden ? pr.customPrice : pr.suggestedPrice}
                  </p>
                  {isOverridden && (
                    <button
                      onClick={() => { setPriceOverride(null); setPriceInput('') }}
                      title={pr.resetPrice}
                      className="text-blue-500/60 hover:text-blue-500 transition-colors"
                    >
                      <RotateCcw className="size-3" />
                    </button>
                  )}
                </div>
                <div className="relative flex items-center justify-center">
                  <span className="text-2xl font-bold text-blue-600 mr-1">$</span>
                  <input
                    type="number" min={0} step={0.01}
                    value={isOverridden ? priceInput : result.salePrice.toFixed(2)}
                    onFocus={e => {
                      const val = (priceOverride ?? result.salePrice).toFixed(2)
                      setPriceInput(val)
                      e.target.select()
                    }}
                    onChange={e => {
                      const raw = e.target.value
                      setPriceInput(raw)
                      const n = parseFloat(raw)
                      if (!isNaN(n) && n > 0) setPriceOverride(n)
                    }}
                    onBlur={e => {
                      const n = parseFloat(e.target.value)
                      if (isNaN(n) || n <= 0) { setPriceOverride(null); setPriceInput('') }
                      else { setPriceOverride(n); setPriceInput(n.toFixed(2)) }
                    }}
                    onWheel={e => e.currentTarget.blur()}
                    className="text-4xl font-bold text-blue-600 bg-transparent border-none outline-none w-40 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                {isOverridden && (
                  <p className="text-xs text-blue-500/60 mt-1">
                    {pr.calculatedPrice}: {fmt(result.salePrice)}
                  </p>
                )}
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge variant="secondary" className="text-xs font-mono">
                  {fmt(finalPrice / (result.totalWeight || 1))}/g sold
                </Badge>
                <Badge variant="secondary" className="text-xs font-mono">
                  ROI ×{result.subtotal > 0 ? (finalPrice / result.subtotal).toFixed(2) : '—'}
                </Badge>
              </div>

              {/* Save as product */}
              <button
                onClick={() => setShowSaveModal(true)}
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-blue-600/30 bg-blue-600/5 hover:bg-blue-600/10 text-blue-600 text-sm font-medium py-2 transition-colors"
              >
                <PackagePlus className="size-4" />
                {pr.saveAsProduct}
              </button>

              {/* Per-batch summary */}
              {batches.length > 1 && (
                <>
                  <Separator />
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{pr.batches}</p>
                    {batches.map((b, i) => (
                      <div key={b.id} className="space-y-0.5">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span className="font-medium">{b.name || `${pr.plate} ${i + 1}`}</span>
                          <span>{b.printHours}h</span>
                        </div>
                        <div className="flex gap-1 flex-wrap">
                          {b.filaments.map(f => (
                            <span key={f.id} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/40 rounded-full px-1.5 py-0.5">
                              <span className="size-1.5 rounded-full" style={{ backgroundColor: f.color }} />
                              {f.weightG}g
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Per-filament material breakdown (multi-color) */}
              {batches.length === 1 && batches[0].filaments.length > 1 && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Filamentos</p>
                    {batches[0].filaments.map(f => {
                      const cost = f.weightG * (f.spoolPriceUSD / Math.max(f.spoolWeightG, 1))
                      return (
                        <div key={f.id} className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <span className="size-2 rounded-full" style={{ backgroundColor: f.color }} />
                            {f.type} · {f.weightG}g
                          </span>
                          <span className="font-mono">{fmt(cost)}</span>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

            </CardContent>
          </Card>
        </div>
      </div>

      {/* Save as product modal */}
      {showSaveModal && (
        <SaveProductModal
          costUSD={result.subtotal}
          priceUSD={finalPrice}
          weightG={result.totalWeight}
          printHours={result.totalHours}
          material={batches[0]?.filaments[0]?.type ?? 'PLA'}
          unitsPerRun={unitsPerRun}
          batchCount={batches.length}
          sessionId={activeSessionId}
          onClose={() => setShowSaveModal(false)}
        />
      )}

      {/* Bambu import modal */}
      {bambuTargetBatch && (
        <BambuImportModal
          onSelect={handleBambuSelect}
          onClose={() => setBambuTargetBatch(null)}
        />
      )}
    </div>
  )
}
