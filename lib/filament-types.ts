export interface FilamentSpool {
  id: string
  brand: string
  material: string       // PLA, PETG, ABS, TPU, ASA, PA, PC, etc.
  color: string
  colorHex: string
  weightG: number        // total spool weight (usually 1000)
  remainingG: number     // how much is left
  priceUSD: number       // what you paid for the full spool
  purchasedAt?: string   // ISO date
  notes?: string
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
