'use client'

import { useState, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Info, Plus, X, Layers, RotateCcw, Palette } from 'lucide-react'
import { SlicerImport } from './slicer-import'
import { PrinterSelect, type SelectedPrinter } from './printer-select'
import type { SlicerData } from '@/lib/parse-gcode'
import { useT } from '@/lib/i18n'

// ── Types ──────────────────────────────────────────────────────

export interface BatchFilament {
  id: string
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
  // Defaults for new filaments
  defaultSpoolPrice: number
  defaultSpoolWeight: number
}

// ── Defaults ───────────────────────────────────────────────────

const DEFAULT_SHARED: SharedValues = {
  printerWatts:     120,
  electricityCost:  0.15,
  hourlyRate:       2,
  failureRate:      10,
  marginPct:        40,
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

  const energy   = (totalHours * s.printerWatts / 1000) * s.electricityCost
  const machine  = totalHours * s.hourlyRate
  const subtotal = (material + energy + machine) * (1 + s.failureRate / 100)
  const salePrice = s.marginPct >= 100 ? subtotal * 2 : subtotal / (1 - s.marginPct / 100)
  const profit   = salePrice - subtotal

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

// ── Shared field config ─────────────────────────────────────────

interface Field { id: keyof SharedValues; label: string; unit: string; min: number; step: number; tip: string }

const SHARED_FIELDS: Field[] = [
  { id: 'printerWatts',      label: 'Printer power',          unit: 'W',    min: 10,   step: 5,     tip: 'Average wattage. Bambu A1 ≈ 120W during printing.' },
  { id: 'electricityCost',   label: 'Electricity cost',       unit: '$/kWh',min: 0.01, step: 0.01,  tip: 'Your electricity rate per kilowatt-hour.' },
  { id: 'hourlyRate',        label: 'Equipment amortization', unit: '$/h',  min: 0,    step: 0.001, tip: 'Auto-filled from equipment value ÷ lifespan when you select a printer.' },
  { id: 'failureRate',       label: 'Failure / waste',        unit: '%',    min: 0,    step: 1,     tip: 'Buffer for failed prints and material waste.' },
  { id: 'marginPct',         label: 'Profit margin',          unit: '%',    min: 0,    step: 5,     tip: 'Your desired profit margin on top of all costs.' },
]

const SPOOL_DEFAULTS: Field[] = [
  { id: 'defaultSpoolPrice',  label: 'Default spool price',  unit: '$',  min: 0.01, step: 0.5, tip: 'Default price used when adding a new filament.' },
  { id: 'defaultSpoolWeight', label: 'Default spool weight', unit: 'g',  min: 100,  step: 50,  tip: 'Default spool weight in grams (usually 1000 g).' },
]

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
          className={`h-full rounded-full transition-all ${accent ? 'bg-orange-500' : 'bg-muted-foreground/40'}`}
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
  onUpdate,
  onRemove,
}: {
  filament: BatchFilament
  canRemove: boolean
  onUpdate: (id: string, field: keyof BatchFilament, value: string | number) => void
  onRemove: (id: string) => void
}) {
  return (
    <div className="flex items-end gap-2 rounded-md bg-muted/30 border border-border/50 p-2">
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
  platLabel,
  importFileLabel,
  defaultSpoolPrice,
  defaultSpoolWeight,
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
  platLabel: string
  importFileLabel: string
  defaultSpoolPrice: number
  defaultSpoolWeight: number
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
          <Layers className="size-3.5 text-orange-500/70" />
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
            onUpdate={(fid, field, val) => onUpdateFilament(batch.id, fid, field, val)}
            onRemove={fid => onRemoveFilament(batch.id, fid)}
          />
        ))}
      </div>

      {/* Add color + Slicer import */}
      <div className="flex gap-2">
        <button
          onClick={() => onAddFilament(batch.id)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border hover:border-orange-500/40 rounded-md px-2 py-1 transition-colors"
        >
          <Palette className="size-3" />
          + cor
        </button>
        <div className="flex-1">
          <SlicerImport onImport={handleImport} compact label={importFileLabel} />
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────

export function PricingCalculator() {
  const { t } = useT()
  const pr = t.pricing

  const [shared, setShared]         = useState<SharedValues>(DEFAULT_SHARED)
  const [batches, setBatches]       = useState<Batch[]>([newBatch()])
  const [printerId, setPrinterId]   = useState('')
  const [amortLabel, setAmortLabel] = useState<string | null>(null)
  const [priceOverride, setPriceOverride] = useState<number | null>(null)
  const [priceInput, setPriceInput]       = useState('')

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

  // ── Calculation ────────────────────────────────────────────
  const result = useMemo(() => calculate(batches, shared), [batches, shared])

  const finalPrice   = priceOverride ?? result.salePrice
  const finalProfit  = finalPrice - result.subtotal
  const effectivePct = finalPrice > 0 ? (finalProfit / finalPrice) * 100 : 0
  const isOverridden = priceOverride !== null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── Left: inputs ──────────────────────────────────── */}
        <div className="lg:col-span-3 space-y-4">

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
                  platLabel={pr.plate}
                  importFileLabel={pr.importFile}
                  defaultSpoolPrice={shared.defaultSpoolPrice}
                  defaultSpoolWeight={shared.defaultSpoolWeight}
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
              <div className="grid grid-cols-3 gap-4">
                {SHARED_FIELDS.slice(2).map(f => (
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

        {/* ── Right: result panel ────────────────────────────── */}
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
                <span className={isOverridden ? 'text-orange-400' : 'text-muted-foreground'}>
                  {pr.profit}{' '}
                  <span className={`font-semibold ${effectivePct < 0 ? 'text-red-400' : isOverridden ? 'text-orange-400' : ''}`}>
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
                isOverridden ? 'bg-orange-500/15 border-orange-500/40' : 'bg-orange-500/10 border-orange-500/20'
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
                      if (!isNaN(n) && n >= 0) setPriceOverride(n)
                    }}
                    onBlur={e => {
                      const n = parseFloat(e.target.value)
                      if (isNaN(n) || n <= 0) { setPriceOverride(null); setPriceInput('') }
                      else { setPriceOverride(n); setPriceInput(n.toFixed(2)) }
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

              {/* Badges */}
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge variant="secondary" className="text-xs font-mono">
                  {fmt(finalPrice / (result.totalWeight || 1))}/g sold
                </Badge>
                <Badge variant="secondary" className="text-xs font-mono">
                  ROI ×{result.subtotal > 0 ? (finalPrice / result.subtotal).toFixed(2) : '—'}
                </Badge>
              </div>

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
    </div>
  )
}
