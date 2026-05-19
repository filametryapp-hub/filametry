export type MaterialCategory = 'Filament' | 'Tool' | 'Packaging' | 'Accessory' | 'Other'
export type MaterialUnit = 'g' | 'kg' | 'units' | 'm' | 'ml'

export interface FilamentSpool {
  id: string
  brand: string
  material: string
  color: string
  colorHex: string
  weightG: number
  remainingG: number
  priceUSD: number
  purchasedAt?: string
  notes?: string
  category?: MaterialCategory
  unit?: MaterialUnit
  paidBy?: string
  // transient: initial partner payment recorded at creation time (not stored in filaments table)
  paidByName?: string
  paidByAmount?: number
}

// ── Full material list (2024-2025) ─────────────────────────────
export const MATERIALS = [
  // PLA family
  'PLA', 'PLA+', 'PLA Matte', 'PLA Silk', 'PLA Silk Rainbow', 'PLA Silk Dual-Color',
  'PLA Galaxy', 'PLA Metal', 'PLA-CF', 'PLA-GF',
  'PLA Wood', 'PLA Marble', 'PLA Stone', 'PLA Glow in the Dark',
  'PLA Translucente', 'PLA High Speed', 'PLA Tough', 'PLA Lightweight (LW)',
  'PLA Color Change Temp', 'PLA Color Change UV',
  'PLA Fluorescente', 'PLA Reciclado',
  // PETG family
  'PETG', 'PETG+', 'PETG-CF', 'PETG-GF',
  'PETG Translucente', 'PETG Matte', 'PETG Silk', 'PETG High Speed', 'PETG Glow',
  // ABS family
  'ABS', 'ABS+', 'ABS-CF', 'ABS-GF', 'ABS High Temp',
  // ASA family
  'ASA', 'ASA+', 'ASA-CF', 'ASA-GF',
  // Flexíveis
  'TPU 95A', 'TPU 90A', 'TPU 85A', 'TPU-CF', 'TPU High Speed',
  'TPE', 'TPA',
  // Nylon / PA
  'PA6', 'PA6-CF', 'PA6-GF', 'PA12', 'PA12-CF', 'PA12-GF',
  'PA11', 'PA11-CF', 'PAHT-CF',
  // Policarbonato
  'PC', 'PC+', 'PC-CF', 'PC-ABS', 'PC-ABS-CF', 'PC-FR',
  // Polipropileno
  'PP', 'PP-CF', 'PP-GF',
  // Suporte
  'PVA', 'PVA+', 'HIPS', 'Breakaway', 'Support W', 'Support PA', 'Support G',
  // PVB
  'PVB', 'PVB Translucente',
  // Composites / Fills
  'Wood Fill', 'Bamboo Fill', 'Cork Fill',
  'Copper Fill', 'Bronze Fill', 'Brass Fill', 'Steel Fill', 'Iron Fill', 'Aluminum Fill',
  'Marble Fill', 'Stone Fill', 'Ceramic Fill',
  'Condutivo (ESD)', 'Magnético',
  // High-performance engineering
  'PEEK', 'PEEK-CF', 'PEKK', 'PEKK-CF',
  'PEI / Ultem 9085', 'PEI / Ultem 1010',
  'POM / Delrin', 'PPS', 'PPS-CF', 'PSU / PPSU',
  // Resin
  'Resina Standard', 'Resina ABS-Like', 'Resina Water-Washable',
  'Resina Tough', 'Resina High-Temp', 'Resina Flexível', 'Resina Elástica',
  'Resina Transparente', 'Resina Matte', 'Resina Castable', 'Resina Dental',
  'Resina UV-Estável',
] as const

export type Material = typeof MATERIALS[number]

// ── Grouped for UI selectors ───────────────────────────────────
export const MATERIAL_GROUPS: { label: string; items: string[] }[] = [
  {
    label: 'PLA',
    items: [
      'PLA', 'PLA+', 'PLA Matte', 'PLA Silk', 'PLA Silk Rainbow', 'PLA Silk Dual-Color',
      'PLA Galaxy', 'PLA Metal', 'PLA-CF', 'PLA-GF',
      'PLA Wood', 'PLA Marble', 'PLA Stone', 'PLA Glow in the Dark',
      'PLA Translucente', 'PLA High Speed', 'PLA Tough', 'PLA Lightweight (LW)',
      'PLA Color Change Temp', 'PLA Color Change UV',
      'PLA Fluorescente', 'PLA Reciclado',
    ],
  },
  {
    label: 'PETG',
    items: [
      'PETG', 'PETG+', 'PETG-CF', 'PETG-GF',
      'PETG Translucente', 'PETG Matte', 'PETG Silk', 'PETG High Speed', 'PETG Glow',
    ],
  },
  {
    label: 'ABS / ASA',
    items: [
      'ABS', 'ABS+', 'ABS-CF', 'ABS-GF', 'ABS High Temp',
      'ASA', 'ASA+', 'ASA-CF', 'ASA-GF',
    ],
  },
  {
    label: 'Flexível',
    items: [
      'TPU 95A', 'TPU 90A', 'TPU 85A', 'TPU-CF', 'TPU High Speed',
      'TPE', 'TPA',
    ],
  },
  {
    label: 'Nylon / PA',
    items: [
      'PA6', 'PA6-CF', 'PA6-GF',
      'PA12', 'PA12-CF', 'PA12-GF',
      'PA11', 'PA11-CF', 'PAHT-CF',
    ],
  },
  {
    label: 'PC / PP',
    items: [
      'PC', 'PC+', 'PC-CF', 'PC-ABS', 'PC-ABS-CF', 'PC-FR',
      'PP', 'PP-CF', 'PP-GF',
    ],
  },
  {
    label: 'Suporte',
    items: [
      'PVA', 'PVA+', 'HIPS', 'Breakaway', 'Support W', 'Support PA', 'Support G',
    ],
  },
  {
    label: 'Composites',
    items: [
      'PVB', 'PVB Translucente',
      'Wood Fill', 'Bamboo Fill', 'Cork Fill',
      'Copper Fill', 'Bronze Fill', 'Brass Fill', 'Steel Fill', 'Iron Fill', 'Aluminum Fill',
      'Marble Fill', 'Stone Fill', 'Ceramic Fill',
      'Condutivo (ESD)', 'Magnético',
    ],
  },
  {
    label: 'Engenharia',
    items: [
      'PEEK', 'PEEK-CF', 'PEKK', 'PEKK-CF',
      'PEI / Ultem 9085', 'PEI / Ultem 1010',
      'POM / Delrin', 'PPS', 'PPS-CF', 'PSU / PPSU',
    ],
  },
  {
    label: 'Resina',
    items: [
      'Resina Standard', 'Resina ABS-Like', 'Resina Water-Washable',
      'Resina Tough', 'Resina High-Temp', 'Resina Flexível', 'Resina Elástica',
      'Resina Transparente', 'Resina Matte', 'Resina Castable', 'Resina Dental',
      'Resina UV-Estável',
    ],
  },
]

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
