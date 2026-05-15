export interface Printer {
  id: string
  brand: string
  model: string
  watts: number          // average watts during printing
  type: 'FDM' | 'Resin'
  buildVolume?: string
}

export const PRINTERS: Printer[] = [
  // ── Bambu Lab ────────────────────────────────────────────────────────
  { id: 'bambu-a1',         brand: 'Bambu Lab', model: 'A1',            watts: 120,  type: 'FDM',   buildVolume: '256×256×256 mm' },
  { id: 'bambu-a1-mini',    brand: 'Bambu Lab', model: 'A1 Mini',       watts: 80,   type: 'FDM',   buildVolume: '180×180×180 mm' },
  { id: 'bambu-p1p',        brand: 'Bambu Lab', model: 'P1P',           watts: 140,  type: 'FDM',   buildVolume: '256×256×256 mm' },
  { id: 'bambu-p1s',        brand: 'Bambu Lab', model: 'P1S',           watts: 160,  type: 'FDM',   buildVolume: '256×256×256 mm' },
  { id: 'bambu-x1c',        brand: 'Bambu Lab', model: 'X1 Carbon',     watts: 200,  type: 'FDM',   buildVolume: '256×256×256 mm' },
  { id: 'bambu-x1e',        brand: 'Bambu Lab', model: 'X1E',           watts: 210,  type: 'FDM',   buildVolume: '256×256×256 mm' },
  { id: 'bambu-h2d',        brand: 'Bambu Lab', model: 'H2D',           watts: 250,  type: 'FDM',   buildVolume: '350×320×325 mm' },

  // ── Creality ─────────────────────────────────────────────────────────
  { id: 'creality-ender3',       brand: 'Creality', model: 'Ender-3',           watts: 80,   type: 'FDM', buildVolume: '220×220×250 mm' },
  { id: 'creality-ender3-v2',    brand: 'Creality', model: 'Ender-3 V2',        watts: 80,   type: 'FDM', buildVolume: '220×220×250 mm' },
  { id: 'creality-ender3-v3',    brand: 'Creality', model: 'Ender-3 V3',        watts: 100,  type: 'FDM', buildVolume: '220×220×250 mm' },
  { id: 'creality-ender3-s1',    brand: 'Creality', model: 'Ender-3 S1',        watts: 110,  type: 'FDM', buildVolume: '220×220×270 mm' },
  { id: 'creality-ender3-s1pro', brand: 'Creality', model: 'Ender-3 S1 Pro',    watts: 115,  type: 'FDM', buildVolume: '220×220×270 mm' },
  { id: 'creality-ender5-s1',    brand: 'Creality', model: 'Ender-5 S1',        watts: 120,  type: 'FDM', buildVolume: '220×220×280 mm' },
  { id: 'creality-cr10',         brand: 'Creality', model: 'CR-10',             watts: 150,  type: 'FDM', buildVolume: '300×300×400 mm' },
  { id: 'creality-cr10-v3',      brand: 'Creality', model: 'CR-10 V3',          watts: 155,  type: 'FDM', buildVolume: '300×300×400 mm' },
  { id: 'creality-cr10-smart',   brand: 'Creality', model: 'CR-10 Smart Pro',   watts: 160,  type: 'FDM', buildVolume: '300×300×400 mm' },
  { id: 'creality-cr6-se',       brand: 'Creality', model: 'CR-6 SE',           watts: 100,  type: 'FDM', buildVolume: '235×235×250 mm' },
  { id: 'creality-k1',           brand: 'Creality', model: 'K1',                watts: 250,  type: 'FDM', buildVolume: '220×220×250 mm' },
  { id: 'creality-k1c',          brand: 'Creality', model: 'K1C',               watts: 250,  type: 'FDM', buildVolume: '220×220×250 mm' },
  { id: 'creality-k1-max',       brand: 'Creality', model: 'K1 Max',            watts: 270,  type: 'FDM', buildVolume: '300×300×300 mm' },
  { id: 'creality-k2-plus',      brand: 'Creality', model: 'K2 Plus',           watts: 300,  type: 'FDM', buildVolume: '350×350×350 mm' },
  { id: 'creality-sermoon-v1',   brand: 'Creality', model: 'Sermoon V1 Pro',    watts: 110,  type: 'FDM', buildVolume: '175×175×165 mm' },

  // ── Prusa Research ───────────────────────────────────────────────────
  { id: 'prusa-mk3s',    brand: 'Prusa Research', model: 'i3 MK3S+',   watts: 80,   type: 'FDM', buildVolume: '250×210×210 mm' },
  { id: 'prusa-mk4',     brand: 'Prusa Research', model: 'i3 MK4',     watts: 90,   type: 'FDM', buildVolume: '250×210×220 mm' },
  { id: 'prusa-mk4s',    brand: 'Prusa Research', model: 'i3 MK4S',    watts: 90,   type: 'FDM', buildVolume: '250×210×220 mm' },
  { id: 'prusa-mini',    brand: 'Prusa Research', model: 'MINI+',      watts: 60,   type: 'FDM', buildVolume: '180×180×180 mm' },
  { id: 'prusa-xl',      brand: 'Prusa Research', model: 'XL',         watts: 200,  type: 'FDM', buildVolume: '360×360×360 mm' },
  { id: 'prusa-core1',   brand: 'Prusa Research', model: 'Core One',   watts: 120,  type: 'FDM', buildVolume: '250×220×270 mm' },

  // ── Anycubic ─────────────────────────────────────────────────────────
  { id: 'anycubic-kobra2',       brand: 'Anycubic', model: 'Kobra 2',          watts: 100,  type: 'FDM', buildVolume: '220×220×250 mm' },
  { id: 'anycubic-kobra2-pro',   brand: 'Anycubic', model: 'Kobra 2 Pro',      watts: 110,  type: 'FDM', buildVolume: '220×220×250 mm' },
  { id: 'anycubic-kobra2-plus',  brand: 'Anycubic', model: 'Kobra 2 Plus',     watts: 130,  type: 'FDM', buildVolume: '320×320×400 mm' },
  { id: 'anycubic-kobra2-max',   brand: 'Anycubic', model: 'Kobra 2 Max',      watts: 150,  type: 'FDM', buildVolume: '420×420×500 mm' },
  { id: 'anycubic-kobra3',       brand: 'Anycubic', model: 'Kobra 3',          watts: 120,  type: 'FDM', buildVolume: '250×220×260 mm' },
  { id: 'anycubic-kobra3-combo', brand: 'Anycubic', model: 'Kobra 3 Combo',    watts: 150,  type: 'FDM', buildVolume: '250×220×260 mm' },
  { id: 'anycubic-mega-s',       brand: 'Anycubic', model: 'Mega S',           watts: 80,   type: 'FDM', buildVolume: '210×210×205 mm' },

  // ── Elegoo ───────────────────────────────────────────────────────────
  { id: 'elegoo-neptune4',       brand: 'Elegoo', model: 'Neptune 4',           watts: 100,  type: 'FDM', buildVolume: '225×225×265 mm' },
  { id: 'elegoo-neptune4-pro',   brand: 'Elegoo', model: 'Neptune 4 Pro',       watts: 110,  type: 'FDM', buildVolume: '225×225×265 mm' },
  { id: 'elegoo-neptune4-plus',  brand: 'Elegoo', model: 'Neptune 4 Plus',      watts: 130,  type: 'FDM', buildVolume: '320×320×385 mm' },
  { id: 'elegoo-neptune4-max',   brand: 'Elegoo', model: 'Neptune 4 Max',       watts: 150,  type: 'FDM', buildVolume: '420×420×480 mm' },
  { id: 'elegoo-neptune3',       brand: 'Elegoo', model: 'Neptune 3 Pro',       watts: 90,   type: 'FDM', buildVolume: '225×225×280 mm' },
  { id: 'elegoo-mars4-ultra',    brand: 'Elegoo', model: 'Mars 4 Ultra',        watts: 50,   type: 'Resin', buildVolume: '153×77×165 mm' },
  { id: 'elegoo-saturn3-ultra',  brand: 'Elegoo', model: 'Saturn 3 Ultra',      watts: 60,   type: 'Resin', buildVolume: '218×123×260 mm' },
  { id: 'elegoo-saturn4-ultra',  brand: 'Elegoo', model: 'Saturn 4 Ultra',      watts: 65,   type: 'Resin', buildVolume: '218×123×220 mm' },

  // ── FlashForge ───────────────────────────────────────────────────────
  { id: 'flashforge-adventurer5m',     brand: 'FlashForge', model: 'Adventurer 5M',       watts: 200, type: 'FDM', buildVolume: '220×220×220 mm' },
  { id: 'flashforge-adventurer5m-pro', brand: 'FlashForge', model: 'Adventurer 5M Pro',   watts: 220, type: 'FDM', buildVolume: '220×220×220 mm' },
  { id: 'flashforge-creator4',         brand: 'FlashForge', model: 'Creator 4',            watts: 300, type: 'FDM', buildVolume: '400×350×500 mm' },
  { id: 'flashforge-creator3-pro',     brand: 'FlashForge', model: 'Creator 3 Pro',        watts: 200, type: 'FDM', buildVolume: '300×250×200 mm' },
  { id: 'flashforge-guider3-plus',     brand: 'FlashForge', model: 'Guider 3 Plus',        watts: 300, type: 'FDM', buildVolume: '350×350×600 mm' },

  // ── Sovol ────────────────────────────────────────────────────────────
  { id: 'sovol-sv06',      brand: 'Sovol', model: 'SV06',         watts: 90,  type: 'FDM', buildVolume: '220×220×250 mm' },
  { id: 'sovol-sv06-plus', brand: 'Sovol', model: 'SV06 Plus',    watts: 110, type: 'FDM', buildVolume: '300×300×340 mm' },
  { id: 'sovol-sv07',      brand: 'Sovol', model: 'SV07',         watts: 220, type: 'FDM', buildVolume: '220×220×250 mm' },
  { id: 'sovol-sv07-plus', brand: 'Sovol', model: 'SV07 Plus',    watts: 260, type: 'FDM', buildVolume: '300×300×350 mm' },
  { id: 'sovol-sv08',      brand: 'Sovol', model: 'SV08',         watts: 300, type: 'FDM', buildVolume: '350×350×350 mm' },

  // ── Artillery ────────────────────────────────────────────────────────
  { id: 'artillery-sw-x2',    brand: 'Artillery', model: 'Sidewinder X2',    watts: 130, type: 'FDM', buildVolume: '300×300×400 mm' },
  { id: 'artillery-genius-pro',brand: 'Artillery', model: 'Genius Pro',       watts: 100, type: 'FDM', buildVolume: '220×220×250 mm' },
  { id: 'artillery-hornet',    brand: 'Artillery', model: 'Hornet',           watts: 90,  type: 'FDM', buildVolume: '220×220×250 mm' },

  // ── Raise3D ──────────────────────────────────────────────────────────
  { id: 'raise3d-pro3',      brand: 'Raise3D', model: 'Pro3',          watts: 300, type: 'FDM', buildVolume: '300×300×300 mm' },
  { id: 'raise3d-pro3-plus', brand: 'Raise3D', model: 'Pro3 Plus',     watts: 350, type: 'FDM', buildVolume: '300×300×605 mm' },
  { id: 'raise3d-e2',        brand: 'Raise3D', model: 'E2',            watts: 250, type: 'FDM', buildVolume: '330×240×240 mm' },

  // ── Formlabs ─────────────────────────────────────────────────────────
  { id: 'formlabs-form3',    brand: 'Formlabs', model: 'Form 3',       watts: 65,  type: 'Resin', buildVolume: '145×145×185 mm' },
  { id: 'formlabs-form3l',   brand: 'Formlabs', model: 'Form 3L',      watts: 75,  type: 'Resin', buildVolume: '335×200×300 mm' },
  { id: 'formlabs-form4',    brand: 'Formlabs', model: 'Form 4',       watts: 70,  type: 'Resin', buildVolume: '200×125×210 mm' },

  // ── Phrozen ──────────────────────────────────────────────────────────
  { id: 'phrozen-sonic-mega8k', brand: 'Phrozen', model: 'Sonic Mega 8K',   watts: 60, type: 'Resin', buildVolume: '330×185×400 mm' },
  { id: 'phrozen-sonic-mini8k', brand: 'Phrozen', model: 'Sonic Mini 8K S', watts: 50, type: 'Resin', buildVolume: '165×72×180 mm' },

  // ── Anycubic Resin ───────────────────────────────────────────────────
  { id: 'anycubic-photon-mono-m5s',  brand: 'Anycubic', model: 'Photon Mono M5s',  watts: 50, type: 'Resin', buildVolume: '218×123×200 mm' },
  { id: 'anycubic-photon-m3-plus',   brand: 'Anycubic', model: 'Photon M3 Plus',   watts: 55, type: 'Resin', buildVolume: '197×122×245 mm' },

  // ── MakerBot / Stratasys ──────────────────────────────────────────────
  { id: 'makerbot-method-x',  brand: 'MakerBot', model: 'METHOD X',     watts: 600, type: 'FDM', buildVolume: '190×190×196 mm' },
  { id: 'makerbot-sketch',    brand: 'MakerBot', model: 'Sketch',       watts: 200, type: 'FDM', buildVolume: '150×150×150 mm' },

  // ── UltiMaker ────────────────────────────────────────────────────────
  { id: 'ultimaker-s5',    brand: 'UltiMaker', model: 'S5',         watts: 500, type: 'FDM', buildVolume: '330×240×300 mm' },
  { id: 'ultimaker-s7',    brand: 'UltiMaker', model: 'S7',         watts: 550, type: 'FDM', buildVolume: '330×240×300 mm' },
  { id: 'ultimaker-s3',    brand: 'UltiMaker', model: 'S3',         watts: 350, type: 'FDM', buildVolume: '230×190×200 mm' },

  // ── Voron (DIY popular kits) ─────────────────────────────────────────
  { id: 'voron-0-2',    brand: 'Voron Design', model: 'V0.2',    watts: 100, type: 'FDM', buildVolume: '120×120×120 mm' },
  { id: 'voron-2-4',    brand: 'Voron Design', model: 'V2.4',    watts: 400, type: 'FDM', buildVolume: '250–350 mm³' },
  { id: 'voron-trident', brand: 'Voron Design', model: 'Trident', watts: 350, type: 'FDM', buildVolume: '250×250×250 mm' },
  { id: 'voron-switchwire', brand: 'Voron Design', model: 'Switchwire', watts: 300, type: 'FDM', buildVolume: '250×210×200 mm' },

  // ── Bambu Lab AMS add-on note: watts already includes AMS overhead ──
]

// Group by brand for easy UI rendering
export function getPrintersByBrand(): Record<string, Printer[]> {
  return PRINTERS.reduce((acc, printer) => {
    if (!acc[printer.brand]) acc[printer.brand] = []
    acc[printer.brand].push(printer)
    return acc
  }, {} as Record<string, Printer[]>)
}

export function getPrinterById(id: string): Printer | undefined {
  return PRINTERS.find(p => p.id === id)
}
