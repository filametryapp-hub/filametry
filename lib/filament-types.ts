export type MaterialCategory = 'Filament' | 'Tool' | 'Packaging' | 'Accessory' | 'Other'
export type MaterialUnit = 'g' | 'kg' | 'units' | 'm' | 'ml'

export interface FilamentSpool {
  id: string
  brand: string
  material: string       // PLA, PETG, ABS, TPU, etc. (for filaments)
  color: string          // name/color or item name
  colorHex: string
  weightG: number        // total quantity
  remainingG: number     // remaining quantity
  priceUSD: number       // purchase price
  purchasedAt?: string   // ISO date
  notes?: string
  category?: MaterialCategory
  unit?: MaterialUnit
}

export const MATERIALS = [
  'PLA', 'PLA+', 'PLA Matte', 'PLA Silk', 'PLA-CF',
  'PETG', 'PETG-CF',
  'ABS', 'ASA',
  'TPU', 'TPE',
  'PA (Nylon)', 'PA-CF', 'PA-GF',
  'PC', 'PC-ABS',
  'HIPS',
  'PVA',
  'Resin (Standard)', 'Resin (ABS-like)', 'Resin (Flexible)',
] as const

export type Material = typeof MATERIALS[number]

// Cost per gram remaining
export function costPerGram(spool: FilamentSpool): number {
  return spool.priceUSD / spool.weightG
}

// % remaining
export function remainingPct(spool: FilamentSpool): number {
  return Math.min(100, (spool.remainingG / spool.weightG) * 100)
}

// Value of remaining filament
export function remainingValue(spool: FilamentSpool): number {
  return costPerGram(spool) * spool.remainingG
}
