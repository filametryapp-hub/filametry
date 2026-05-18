export interface SlicerFilament {
  weightG: number
  color: string       // hex, e.g. "#FFFFFF"
  type: string        // "PLA", "PETG", …
  costPerSpool: number
}

export interface SlicerData {
  weightG?: number
  printHours?: number
  filamentCostUSD?: number
  filamentType?: string
  nozzleDiameter?: number
  /** Populated when the slicer reports per-filament data (multi-colour prints) */
  filaments?: SlicerFilament[]
}

function parseTime(str: string): number {
  // Formats: "3h 12m", "3h12m", "12m", "45m 30s", "2h", "130m"
  let hours = 0
  const h = str.match(/(\d+)\s*h/)
  const m = str.match(/(\d+)\s*m/)
  const s = str.match(/(\d+)\s*s/)
  if (h) hours += parseInt(h[1])
  if (m) hours += parseInt(m[1]) / 60
  if (s) hours += parseInt(s[1]) / 3600
  return parseFloat(hours.toFixed(4))
}

function extractFromGcode(text: string): SlicerData {
  const result: SlicerData = {}

  // ── Weight ──────────────────────────────────────────────────
  // Bambu Studio: "; total filament weight [g] : 1.36,26.03"
  // Values are comma-separated when multiple filaments are used.
  const weightMatchBambu = text.match(/;\s*total filament weight \[g\]\s*:\s*([\d.,]+)/i)
  if (weightMatchBambu) {
    const weights = weightMatchBambu[1].split(',').map(Number).filter(n => !isNaN(n))
    result.weightG = parseFloat(weights.reduce((a, b) => a + b, 0).toFixed(2))

    if (weights.length > 1) {
      // Parse per-filament metadata ──────────────────────────
      // colours are semicolon-separated: "; filament_colour = #161616;#FFFFFF"
      const colourRaw = text.match(/;\s*filament_colour\s*=\s*([^\n]+)/i)?.[1] ?? ''
      const colours = colourRaw.split(';').map(s => s.trim()).filter(Boolean)

      // types are semicolon-separated: "; filament_type = PLA;PLA"
      const typeRaw = text.match(/;\s*filament_type\s*[=:]\s*([^\n;]+)/i)?.[1] ?? ''
      const types = typeRaw.split(/[;,]/).map(s => s.trim()).filter(Boolean)

      // costs are comma-separated: "; filament_cost = 20,20"
      const costRaw = text.match(/;\s*filament_cost\s*=\s*([\d.,]+)/i)?.[1] ?? ''
      const costs = costRaw.split(',').map(Number)

      result.filaments = weights.map((w, i) => ({
        weightG: w,
        color: colours[i] ?? '#888888',
        type: types[i] ?? 'PLA',
        costPerSpool: !isNaN(costs[i]) ? costs[i] : 20,
      }))
    }
  }

  if (!result.weightG) {
    const weightMatch =
      text.match(/;\s*total filament used \[g\]\s*=\s*([\d.]+)/i) ||
      text.match(/;\s*filament used \[g\]\s*=\s*([\d.]+)/i) ||
      text.match(/;\s*filament_weight\s*=\s*([\d.]+)/i)
    if (weightMatch) result.weightG = parseFloat(weightMatch[1])
  }

  // ── Print time ───────────────────────────────────────────────
  // Bambu Studio: "; total estimated time: 1h 30m 56s"
  const timeMatchBambu =
    text.match(/;\s*total estimated time\s*:\s*([^;\n]+)/i) ||
    text.match(/;\s*model printing time\s*:\s*([^;\n]+)/i)
  if (timeMatchBambu) {
    result.printHours = parseTime(timeMatchBambu[1].trim())
  }

  if (!result.printHours) {
    const timeMatch =
      text.match(/;\s*estimated printing time \(normal mode\)\s*=\s*([^\n]+)/i) ||
      text.match(/;\s*estimated printing time\s*=\s*([^\n]+)/i) ||
      text.match(/;\s*print_time\s*=\s*([^\n]+)/i)
    if (timeMatch) result.printHours = parseTime(timeMatch[1].trim())
  }

  // ── Filament cost (total) ────────────────────────────────────
  const costMatch =
    text.match(/;\s*total filament cost\s*[=:]\s*([\d.]+)/i) ||
    text.match(/;\s*filament cost\s*[=:]\s*([\d.]+)/i)
  if (costMatch) result.filamentCostUSD = parseFloat(costMatch[1])

  // ── Filament type (first) ────────────────────────────────────
  const typeMatch = text.match(/;\s*filament_type\s*[=:]\s*([^\n;]+)/i)
  if (typeMatch) {
    const types = typeMatch[1].split(/[;,]/).map(s => s.trim()).filter(Boolean)
    result.filamentType = types[0]
  }

  // ── Nozzle diameter ──────────────────────────────────────────
  const nozzleMatch = text.match(/;\s*nozzle_diameter\s*[=:]\s*([\d.]+)/i)
  if (nozzleMatch) result.nozzleDiameter = parseFloat(nozzleMatch[1])

  return result
}

async function extract3mf(file: File): Promise<SlicerData> {
  // 3mf is a ZIP — find the gcode inside it
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(file)

  for (const [name, entry] of Object.entries(zip.files)) {
    if (name.endsWith('.gcode') && !entry.dir) {
      const blob = await entry.async('uint8array')
      const head = new TextDecoder().decode(blob.slice(0, 16384))
      const tail = new TextDecoder().decode(blob.slice(Math.max(0, blob.length - 16384)))
      return extractFromGcode(head + '\n' + tail)
    }
  }
  return {}
}

export async function parseSlicerFile(file: File): Promise<SlicerData> {
  const name = file.name.toLowerCase()

  if (name.endsWith('.gcode') || name.endsWith('.g')) {
    const headText = await file.slice(0, 16384).text()
    const tailStart = Math.max(0, file.size - 16384)
    const tailText = await file.slice(tailStart).text()
    const text = headText + '\n' + tailText
    return extractFromGcode(text)
  }

  if (name.endsWith('.3mf')) {
    try {
      return await extract3mf(file)
    } catch {
      return {}
    }
  }

  return {}
}
