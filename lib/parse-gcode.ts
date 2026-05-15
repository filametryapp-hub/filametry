export interface SlicerData {
  weightG?: number
  printHours?: number
  filamentCostUSD?: number
  filamentType?: string
  nozzleDiameter?: number
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

  // Weight — Bambu Studio and PrusaSlicer formats
  const weightMatch =
    text.match(/;\s*total filament used \[g\]\s*=\s*([\d.]+)/i) ||
    text.match(/;\s*filament used \[g\]\s*=\s*([\d.]+)/i) ||
    text.match(/;\s*filament_weight\s*=\s*([\d.]+)/i)
  if (weightMatch) result.weightG = parseFloat(weightMatch[1])

  // Print time
  const timeMatch =
    text.match(/;\s*estimated printing time \(normal mode\)\s*=\s*([^\n]+)/i) ||
    text.match(/;\s*estimated printing time\s*=\s*([^\n]+)/i) ||
    text.match(/;\s*print_time\s*=\s*([^\n]+)/i)
  if (timeMatch) result.printHours = parseTime(timeMatch[1].trim())

  // Filament cost (Bambu Studio calculates this)
  const costMatch =
    text.match(/;\s*total filament cost\s*=\s*([\d.]+)/i) ||
    text.match(/;\s*filament cost\s*=\s*([\d.]+)/i)
  if (costMatch) result.filamentCostUSD = parseFloat(costMatch[1])

  // Filament type
  const typeMatch = text.match(/;\s*filament_type\s*=\s*([^\n;,]+)/i)
  if (typeMatch) result.filamentType = typeMatch[1].trim().split(';')[0].trim()

  // Nozzle
  const nozzleMatch = text.match(/;\s*nozzle_diameter\s*=\s*([\d.]+)/i)
  if (nozzleMatch) result.nozzleDiameter = parseFloat(nozzleMatch[1])

  return result
}

async function extract3mf(file: File): Promise<SlicerData> {
  // 3mf is a ZIP — find the gcode inside it
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(file)

  // Bambu Studio embeds the gcode at Metadata/plate_1.gcode (or similar)
  for (const [name, entry] of Object.entries(zip.files)) {
    if (name.endsWith('.gcode') && !entry.dir) {
      // Read first 8 KB — headers are at the top
      const blob = await entry.async('uint8array')
      const header = new TextDecoder().decode(blob.slice(0, 8192))
      return extractFromGcode(header)
    }
  }
  return {}
}

export async function parseSlicerFile(file: File): Promise<SlicerData> {
  const name = file.name.toLowerCase()

  if (name.endsWith('.gcode') || name.endsWith('.g')) {
    const text = await file.slice(0, 8192).text()
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
