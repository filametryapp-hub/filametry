'use client'

import { useState, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Info } from 'lucide-react'
import { SlicerImport } from './slicer-import'
import { PrinterSelect, type SelectedPrinter } from './printer-select'
import type { SlicerData } from '@/lib/parse-gcode'

interface Field {
  id: string
  label: string
  unit: string
  default: number
  min: number
  step: number
  tip: string
}

const FIELDS: Field[] = [
  { id: 'weightG',       label: 'Print weight',         unit: 'g',    default: 50,    min: 0.1,  step: 1,    tip: 'Grams of filament used. Check your slicer.' },
  { id: 'spoolPriceUSD', label: 'Spool price',           unit: '$',    default: 20,    min: 0.01, step: 0.5,  tip: 'What you paid for the full spool.' },
  { id: 'spoolWeightG',  label: 'Spool weight',          unit: 'g',    default: 1000,  min: 100,  step: 50,   tip: 'Total grams of filament in the spool (usually 1000 g).' },
  { id: 'printHours',    label: 'Print time',            unit: 'h',    default: 3,     min: 0.1,  step: 0.25, tip: 'Total print time in hours.' },
  { id: 'printerWatts',  label: 'Printer power',         unit: 'W',    default: 120,   min: 10,   step: 5,    tip: 'Average wattage. Bambu A1 ≈ 120W during printing.' },
  { id: 'electricityCost',label: 'Electricity cost',     unit: '$/kWh',default: 0.15,  min: 0.01, step: 0.01, tip: 'Your electricity rate per kilowatt-hour.' },
  { id: 'hourlyRate',    label: 'Equipment amortization', unit: '$/h',  default: 2,     min: 0,    step: 0.001,  tip: 'Auto-filled from equipment value ÷ lifespan when you select a registered printer. You can override manually.' },
  { id: 'failureRate',   label: 'Failure / waste',       unit: '%',    default: 10,    min: 0,    step: 1,    tip: 'Add a buffer for failed prints and material waste.' },
  { id: 'marginPct',     label: 'Profit margin',         unit: '%',    default: 40,    min: 0,    step: 5,    tip: 'Your desired profit margin on top of all costs.' },
]

type Values = Record<string, number>

function calculate(v: Values) {
  const costPerG   = v.spoolPriceUSD / v.spoolWeightG
  const material   = v.weightG * costPerG
  const energy     = (v.printHours * v.printerWatts / 1000) * v.electricityCost
  const machine    = v.printHours * v.hourlyRate
  const subtotal   = (material + energy + machine) * (1 + v.failureRate / 100)
  const salePrice  = v.marginPct >= 100 ? subtotal * 2 : subtotal / (1 - v.marginPct / 100)
  const profit     = salePrice - subtotal

  return { material, energy, machine, subtotal, salePrice, profit }
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function pct(part: number, total: number) {
  if (total === 0) return '0%'
  return `${((part / total) * 100).toFixed(0)}%`
}

function NumInput({ field, value, onChange }: { field: Field; value: number; onChange: (v: number) => void }) {
  const isPercent  = field.unit === '%'
  const isDollarPrefix = field.unit === '$'

  return (
    <div className="space-y-1.5">
      <Label htmlFor={field.id} className="text-xs text-muted-foreground flex items-center gap-1">
        {field.label}
        <span className="group relative">
          <Info className="size-3 opacity-40 cursor-help" />
          <span className="absolute left-4 -top-1 z-10 hidden group-hover:block w-52 rounded-md border border-border bg-popover text-popover-foreground text-xs p-2 shadow-md">
            {field.tip}
          </span>
        </span>
      </Label>
      <div className="relative flex items-center">
        {isDollarPrefix && (
          <span className="absolute left-3 text-xs text-muted-foreground pointer-events-none">$</span>
        )}
        <Input
          id={field.id}
          type="number"
          min={field.min}
          step={field.step}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className={`h-8 text-sm ${isDollarPrefix ? 'pl-6' : ''} ${isPercent ? 'pr-7' : ''}`}
        />
        {(isPercent || (!isDollarPrefix && field.unit !== '$')) && (
          <span className="absolute right-3 text-xs text-muted-foreground pointer-events-none">
            {field.unit}
          </span>
        )}
      </div>
    </div>
  )
}

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

export function PricingCalculator() {
  const defaults = Object.fromEntries(FIELDS.map(f => [f.id, f.default]))
  const [values, setValues]     = useState<Values>(defaults)
  const [printerId, setPrinterId] = useState('')
  const [amortLabel, setAmortLabel] = useState<string | null>(null)

  const set = (id: string) => (v: number) => setValues(prev => ({ ...prev, [id]: v }))

  const handleImport = useCallback((data: SlicerData) => {
    setValues(prev => ({
      ...prev,
      ...(data.weightG    !== undefined ? { weightG:       data.weightG }    : {}),
      ...(data.printHours !== undefined ? { printHours:    data.printHours } : {}),
      ...(data.filamentCostUSD !== undefined && data.weightG ? {
        spoolPriceUSD: parseFloat(
          ((data.filamentCostUSD / data.weightG) * prev.spoolWeightG).toFixed(2)
        ),
      } : {}),
    }))
  }, [])

  const handlePrinter = useCallback((printer: SelectedPrinter) => {
    setPrinterId(printer.id)
    setValues(prev => ({
      ...prev,
      printerWatts: printer.watts,
      ...(printer.hourlyRate != null ? { hourlyRate: parseFloat(printer.hourlyRate.toFixed(4)) } : {}),
    }))
    setAmortLabel(printer.hourlyRate != null ? printer.label : null)
  }, [])

  const result = useMemo(() => calculate(values), [values])

  const inputFields   = FIELDS.slice(0, 3)
  const timeFields    = FIELDS.slice(3, 6)
  const extraFields   = FIELDS.slice(6)

  return (
    <div className="space-y-4">
      {/* Slicer import */}
      <SlicerImport onImport={handleImport} />

    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Inputs */}
      <div className="lg:col-span-3 space-y-4">
        {/* Filament */}
        <Card>
          <CardHeader className="pb-3 pt-4 px-5">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Filament</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 grid grid-cols-3 gap-4">
            {inputFields.map(f => (
              <NumInput key={f.id} field={f} value={values[f.id]} onChange={set(f.id)} />
            ))}
          </CardContent>
        </Card>

        {/* Time & Energy */}
        <Card>
          <CardHeader className="pb-3 pt-4 px-5">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Time & Energy</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-4">
            <PrinterSelect value={printerId} onChange={handlePrinter} />
            <div className="grid grid-cols-3 gap-4">
              {timeFields.map(f => (
                <NumInput key={f.id} field={f} value={values[f.id]} onChange={set(f.id)} />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Margins */}
        <Card>
          <CardHeader className="pb-3 pt-4 px-5">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Margin & Overhead</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-3">
            <div className="grid grid-cols-3 gap-4">
              {extraFields.map(f => (
                <NumInput key={f.id} field={f} value={values[f.id]} onChange={set(f.id)} />
              ))}
            </div>
            {amortLabel && (
              <p className="text-xs text-orange-400/80 flex items-center gap-1">
                <span className="inline-block size-1.5 rounded-full bg-orange-400" />
                Amortization auto-filled from: <span className="font-medium">{amortLabel}</span>
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Result panel */}
      <div className="lg:col-span-2">
        <Card className="sticky top-4">
          <CardHeader className="pb-3 pt-4 px-5">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Cost Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-3">
            <CostRow label="Material"       value={result.material} total={result.subtotal} />
            <CostRow label="Energy"         value={result.energy}   total={result.subtotal} />
            <CostRow label="Machine / time" value={result.machine}  total={result.subtotal} />

            <Separator />

            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total cost</span>
              <span>{fmt(result.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Profit ({values.marginPct}%)</span>
              <span className="text-green-400">{fmt(result.profit)}</span>
            </div>

            <Separator />

            {/* Sale price hero */}
            <div className="rounded-xl bg-orange-500/10 border border-orange-500/20 p-4 text-center">
              <p className="text-xs text-orange-400 mb-1 font-mono uppercase tracking-wider">Suggested sale price</p>
              <p className="text-4xl font-bold text-orange-500">{fmt(result.salePrice)}</p>
            </div>

            {/* Breakdown badges */}
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge variant="secondary" className="text-xs font-mono">
                {fmt(values.spoolPriceUSD / values.spoolWeightG)}/g
              </Badge>
              <Badge variant="secondary" className="text-xs font-mono">
                {fmt(result.salePrice / (values.weightG || 1))}/g sold
              </Badge>
              <Badge variant="secondary" className="text-xs font-mono">
                ROI ×{result.subtotal > 0 ? (result.salePrice / result.subtotal).toFixed(2) : '—'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </div>
  )
}
