'use client'

import { useState, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Info, Plus, X, Layers, RotateCcw } from 'lucide-react'
import { SlicerImport } from './slicer-import'
import { PrinterSelect, type SelectedPrinter } from './printer-select'
import type { SlicerData } from '@/lib/parse-gcode'
import { useT } from '@/lib/i18n'

// ── Types ──────────────────────────────────────────────────────

interface Batch {
  id: string
  name: string
  weightG: number
  printHours: number
}

interface SharedValues {
  spoolPriceUSD: number
  spoolWeightG: number
  printerWatts: number
  electricityCost: number
  hourlyRate: number
  failureRate: number
  marginPct: number
}

// ── Fields config ──────────────────────────────────────────────

interface Field {
  id: keyof SharedValues
  label: string
  unit: string
  default: number
  min: number
  step: number
  tip: string
}

const SHARED_FIELDS: Field[] = [
  { id: 'spoolPriceUSD',   label: 'Spool price',            unit: '$',    default: 20,    min: 0.01, step: 0.5,   tip: 'What you paid for the full spool.' },
  { id: 'spoolWeightG',    label: 'Spool weight',           unit: 'g',    default: 1000,  min: 100,  step: 50,    tip: 'Total grams of filament in the spool (usually 1000 g).' },
  { id: 'printerWatts',    label: 'Printer power',          unit: 'W',    default: 120,   min: 10,   step: 5,     tip: 'Average wattage. Bambu A1 ≈ 120W during printing.' },
  { id: 'electricityCost', label: 'Electricity cost',       unit: '$/kWh',default: 0.15,  min: 0.01, step: 0.01,  tip: 'Your electricity rate per kilowatt-hour.' },
  { id: 'hourlyRate',      label: 'Equipment amortization', unit: '$/h',  default: 2,     min: 0,    step: 0.001, tip: 'Auto-filled from equipment value ÷ lifespan when you select a registered printer.' },
  { id: 'failureRate',     label: 'Failure / waste',        unit: '%',    default: 10,    min: 0,    step: 1,     tip: 'Add a buffer for failed prints and material waste.' },
  { id: 'marginPct',       label: 'Profit margin',          unit: '%',    default: 40,    min: 0,    step: 5,     tip: 'Your desired profit margin on top of all costs.' },
]

const DEFAULT_SHARED: SharedValues = {
  spoolPriceUSD:   20,
  spoolWeightG:    1000,
  printerWatts:    120,
  electricityCost: 0.15,
  hourlyRate:      2,
  failureRate:     10,
  marginPct:       40,
}

// ── Calculation ────────────────────────────────────────────────

function calculate(batches: Batch[], s: SharedValues) {
  const totalWeight = batches.reduce((sum, b) => sum + b.weightG, 0)
  const totalHours  = batches.reduce((sum, b) => sum + b.printHours, 0)

  const costPerG  = s.spoolPriceUSD / s.spoolWeightG
  const material  = totalWeight * costPerG
  const energy    = (totalHours * s.printerWatts / 1000) * s.electricityCost
  const machine   = totalHours * s.hourlyRate
  const subtotal  = (material + energy + machine) * (1 + s.failureRate / 100)
  const salePrice = s.marginPct >= 100 ? subtotal * 2 : subtotal / (1 - s.marginPct / 100)
  const profit    = salePrice - subtotal

  return { material, energy, machine, subtotal, salePrice, profit, totalWeight, totalHours }
}

// ── Formatting ─────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function pct(part: number, total: number) {
  if (total === 0) return '0%'
  return `${((part / total) * 100).toFixed(0)}%`
}

// ── NumInput ───────────────────────────────────────────────────

function NumInput({ id, label, unit, value, min, step, tip, onChange }: {
  id: string; label: string; unit: string; value: number
  min: number; step: number; tip: string; onChange: (v: number) => void
}) {
  const isPercent     = unit === '%'
  const isDollarPrefix = unit === '$'

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground flex items-center gap-1">
        {label}
        <span className="group relative">
          <Info className="size-3 opacity-40 cursor-help" />
          <span className="absolute left-4 -top-1 z-10 hidden group-hover:block w-52 rounded-md border border-border bg-popover text-popover-foreground text-xs p-2 shadow-md">
            {tip}
          </span>
        </span>
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
          className={`h-full rounded-full transition-all ${accent ? 'bg-orange-500' : 'bg-muted-foreground/40'}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  )
}

// ── BatchRow ───────────────────────────────────────────────────

function BatchRow({
  batch,
  index,
  canRemove,
  onUpdate,
  onRemove,
  platLabel,
  importFileLabel,
}: {
  batch: Batch
  index: number
  canRemove: boolean
  onUpdate: (id: string, field: 'name' | 'weightG' | 'printHours', value: string | number) => void
  onRemove: (id: string) => void
  platLabel: string
  importFileLabel: string
}) {
  const handleImport = useCallback((data: SlicerData) => {
    if (data.weightG    !== undefined) onUpdate(batch.id, 'weightG',    data.weightG)
    if (data.printHours !== undefined) onUpdate(batch.id, 'printHours', data.printHours)
  }, [batch.id, onUpdate])

  return (
    <div className="rounded-lg border border-border bg-card/50 p-3 space-y-3">
      {/* Header row */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Layers className="size-3.5 text-orange-500/70" />
          <span>{platLabel} {index + 1}</span>
        </div>
        <Input
          value={batch.name}
          onChange={e => onUpdate(batch.id, 'name', e.target.value)}
          placeholder={`${platLabel} ${index + 1}`}
          className="h-7 text-xs flex-1"
        />
        {canRemove && (
          <button
            onClick={() => onRemove(batch.id)}
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors"
            aria-label="remove batch"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* Weight + Time */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Weight (g)</Label>
          <Input
            type="number" min={0.1} step={1}
            value={batch.weightG}
            onChange={e => onUpdate(batch.id, 'weightG', parseFloat(e.target.value) || 0)}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Time (h)</Label>
          <Input
            type="number" min={0.1} step={0.25}
            value={batch.printHours}
            onChange={e => onUpdate(batch.id, 'printHours', parseFloat(e.target.value) || 0)}
            className="h-8 text-sm"
          />
        </div>
      </div>

      {/* Mini slicer import */}
      <SlicerImport onImport={handleImport} compact label={importFileLabel} />
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────

function newBatch(index: number): Batch {
  return { id: crypto.randomUUID(), name: '', weightG: 50, printHours: 3 }
}

export function PricingCalculator() {
  const { t } = useT()
  const pr = t.pricing

  const [shared, setShared]         = useState<SharedValues>(DEFAULT_SHARED)
  const [batches, setBatches]       = useState<Batch[]>([newBatch(0)])
  const [printerId, setPrinterId]   = useState('')
  const [amortLabel, setAmortLabel] = useState<string | null>(null)
  const [priceOverride, setPriceOverride] = useState<number | null>(null)
  const [priceInput, setPriceInput]       = useState('')

  // Shared field setter — changing marginPct clears any price override
  const setSharedField = (id: keyof SharedValues) => (v: number) => {
    setShared(prev => ({ ...prev, [id]: v }))
    if (id === 'marginPct') setPriceOverride(null)
  }

  // Printer selection
  const handlePrinter = useCallback((printer: SelectedPrinter) => {
    setPrinterId(printer.id)
    setShared(prev => ({
      ...prev,
      printerWatts: printer.watts,
      ...(printer.hourlyRate != null ? { hourlyRate: parseFloat(printer.hourlyRate.toFixed(4)) } : {}),
    }))
    setAmortLabel(printer.hourlyRate != null ? printer.label : null)
  }, [])

  // Batch operations
  const addBatch = () => setBatches(prev => [...prev, newBatch(prev.length)])

  const removeBatch = (id: string) =>
    setBatches(prev => prev.filter(b => b.id !== id))

  const updateBatch = useCallback((id: string, field: 'name' | 'weightG' | 'printHours', value: string | number) => {
    setBatches(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b))
  }, [])

  const result = useMemo(() => calculate(batches, shared), [batches, shared])

  // Derived values from price override
  const finalPrice    = priceOverride ?? result.salePrice
  const finalProfit   = finalPrice - result.subtotal
  const effectivePct  = finalPrice > 0
    ? Math.max(-999, (finalProfit / finalPrice) * 100)
    : 0
  const isOverridden  = priceOverride !== null

  const spoolFields = SHARED_FIELDS.slice(0, 2)   // spoolPrice, spoolWeight
  const energyFields = SHARED_FIELDS.slice(2, 4)  // printerWatts, electricityCost
  const marginFields = SHARED_FIELDS.slice(4)     // hourlyRate, failureRate, marginPct

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: inputs */}
        <div className="lg:col-span-3 space-y-4">

          {/* ── Build plates ───────────────────────────────── */}
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
                  canRemove={batches.length > 1}
                  onUpdate={updateBatch}
                  onRemove={removeBatch}
                  platLabel={pr.plate}
                  importFileLabel={pr.importFile}
                />
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={addBatch}
                className="w-full border-dashed text-muted-foreground hover:text-foreground"
              >
                <Plus className="size-3.5 mr-1" />
                {pr.addBatch}
              </Button>

              {/* Totals summary */}
              {batches.length > 1 && (
                <div className="flex gap-4 pt-1 text-xs text-muted-foreground border-t border-border">
                  <span>{pr.totalWeight}: <span className="font-medium text-foreground">{result.totalWeight.toFixed(1)}g</span></span>
                  <span>{pr.totalTime}: <span className="font-medium text-foreground">{result.totalHours.toFixed(2)}h</span></span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Shared: Spool + Printer/Energy ─────────────── */}
          <Card>
            <CardHeader className="pb-3 pt-4 px-5">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{pr.sharedSettings}</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-4">
              {/* Spool */}
              <div className="grid grid-cols-2 gap-4">
                {spoolFields.map(f => (
                  <NumInput key={f.id} id={f.id} label={f.label} unit={f.unit}
                    value={shared[f.id]} min={f.min} step={f.step} tip={f.tip}
                    onChange={setSharedField(f.id)} />
                ))}
              </div>

              <Separator />

              {/* Printer select */}
              <PrinterSelect value={printerId} onChange={handlePrinter} />

              {/* Energy */}
              <div className="grid grid-cols-2 gap-4">
                {energyFields.map(f => (
                  <NumInput key={f.id} id={f.id} label={f.label} unit={f.unit}
                    value={shared[f.id]} min={f.min} step={f.step} tip={f.tip}
                    onChange={setSharedField(f.id)} />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ── Margin & Overhead ──────────────────────────── */}
          <Card>
            <CardHeader className="pb-3 pt-4 px-5">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{pr.marginOverhead}</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-3">
              <div className="grid grid-cols-3 gap-4">
                {marginFields.map(f => (
                  <NumInput key={f.id} id={f.id} label={f.label} unit={f.unit}
                    value={shared[f.id]} min={f.min} step={f.step} tip={f.tip}
                    onChange={setSharedField(f.id)} />
                ))}
              </div>
              {amortLabel && (
                <p className="text-xs text-orange-400/80 flex items-center gap-1">
                  <span className="inline-block size-1.5 rounded-full bg-orange-400" />
                  {pr.amortFrom} <span className="font-medium">{amortLabel}</span>
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: result panel */}
        <div className="lg:col-span-2">
          <Card className="sticky top-4">
            <CardHeader className="pb-3 pt-4 px-5">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{pr.costBreakdown}</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-3">
              <CostRow label={pr.filament}   value={result.material} total={result.subtotal} />
              <CostRow label={pr.timeEnergy} value={result.energy}   total={result.subtotal} />
              <CostRow label={pr.equipAmort} value={result.machine}  total={result.subtotal} />

              <Separator />

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{pr.totalCost}</span>
                <span>{fmt(result.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className={`${isOverridden ? 'text-orange-400' : 'text-muted-foreground'}`}>
                  {pr.profit}{' '}
                  <span className={`font-semibold ${effectivePct < 0 ? 'text-red-400' : isOverridden ? 'text-orange-400' : ''}`}>
                    ({effectivePct.toFixed(1)}%)
                  </span>
                  {isOverridden && (
                    <span className="text-xs text-muted-foreground ml-1">
                      · {pr.effectiveMargin}
                    </span>
                  )}
                </span>
                <span className={`font-medium ${finalProfit < 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {fmt(finalProfit)}
                </span>
              </div>

              <Separator />

              {/* Sale price hero — editable */}
              <div className={`rounded-xl border p-4 text-center transition-colors ${
                isOverridden
                  ? 'bg-orange-500/15 border-orange-500/40'
                  : 'bg-orange-500/10 border-orange-500/20'
              }`}>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <p className="text-xs text-orange-400 font-mono uppercase tracking-wider">
                    {isOverridden ? pr.customPrice : pr.suggestedPrice}
                  </p>
                  {isOverridden && (
                    <button
                      onClick={() => { setPriceOverride(null); setPriceInput('') }}
                      title={pr.resetPrice}
                      className="text-orange-400/60 hover:text-orange-400 transition-colors"
                    >
                      <RotateCcw className="size-3" />
                    </button>
                  )}
                </div>
                <div className="relative flex items-center justify-center">
                  <span className="text-2xl font-bold text-orange-500 mr-1">$</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
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
                      if (!isNaN(n) && n >= 0) setPriceOverride(n)
                    }}
                    onBlur={e => {
                      const n = parseFloat(e.target.value)
                      if (isNaN(n) || n <= 0) {
                        setPriceOverride(null)
                        setPriceInput('')
                      } else {
                        setPriceOverride(n)
                        setPriceInput(n.toFixed(2))
                      }
                    }}
                    className="text-4xl font-bold text-orange-500 bg-transparent border-none outline-none w-40 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                {isOverridden && (
                  <p className="text-xs text-orange-400/60 mt-1">
                    {pr.calculatedPrice}: {fmt(result.salePrice)}
                  </p>
                )}
              </div>

              {/* Stats badges */}
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge variant="secondary" className="text-xs font-mono">
                  {fmt(shared.spoolPriceUSD / shared.spoolWeightG)}/g
                </Badge>
                <Badge variant="secondary" className="text-xs font-mono">
                  {fmt(finalPrice / (result.totalWeight || 1))}/g sold
                </Badge>
                <Badge variant="secondary" className="text-xs font-mono">
                  ROI ×{result.subtotal > 0 ? (finalPrice / result.subtotal).toFixed(2) : '—'}
                </Badge>
              </div>

              {/* Multi-plate summary */}
              {batches.length > 1 && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{pr.batches}</p>
                    {batches.map((b, i) => (
                      <div key={b.id} className="flex justify-between text-xs text-muted-foreground">
                        <span>{b.name || `${pr.plate} ${i + 1}`}</span>
                        <span>{b.weightG}g · {b.printHours}h</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
