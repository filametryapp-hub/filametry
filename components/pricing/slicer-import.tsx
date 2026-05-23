'use client'

import { useCallback, useState } from 'react'
import { Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { parseSlicerFile, type SlicerData } from '@/lib/parse-gcode'
import { cn } from '@/lib/utils'

interface Props {
  onImport: (data: SlicerData) => void
  compact?: boolean
  label?: string
}

type State = 'idle' | 'loading' | 'success' | 'error' | 'empty'

export function SlicerImport({ onImport, compact = false, label }: Props) {
  const [state, setState] = useState<State>('idle')
  const [summary, setSummary] = useState<string>('')
  const [dragging, setDragging] = useState(false)

  const handle = useCallback(async (file: File) => {
    setState('loading')
    setSummary('')
    const data = await parseSlicerFile(file)

    const hasData = Object.keys(data).length > 0 &&
      (data.weightG !== undefined || data.printHours !== undefined)

    if (!hasData) {
      setState('empty')
      setSummary('No slicer data found in this file.')
      return
    }

    const parts: string[] = []
    if (data.weightG)          parts.push(`${data.weightG}g`)
    if (data.printHours)       parts.push(`${(data.printHours).toFixed(2)}h`)
    if (data.filamentCostUSD)  parts.push(`$${data.filamentCostUSD.toFixed(2)} filament cost`)
    if (data.filamentType)     parts.push(data.filamentType)

    setState('success')
    setSummary(parts.join(' · '))
    onImport(data)
  }, [onImport])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handle(file)
  }, [handle])

  const onFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handle(file)
    e.target.value = ''
  }, [handle])

  if (compact) {
    // Compact inline variant for per-batch rows
    return (
      <label className={cn(
        'flex items-center gap-2 cursor-pointer rounded-md border border-dashed px-3 py-1.5 text-xs transition-colors',
        dragging
          ? 'border-blue-600 bg-blue-600/10'
          : state === 'success'
            ? 'border-green-500/40 bg-green-500/5 text-green-400'
            : state === 'error' || state === 'empty'
              ? 'border-red-500/40 text-red-400'
              : 'border-border text-muted-foreground hover:border-blue-600/40 hover:text-foreground'
      )}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <input type="file" accept=".gcode,.g,.3mf" className="sr-only" onChange={onFile} />
        {state === 'loading' && <Loader2 className="size-3 animate-spin shrink-0" />}
        {state === 'success' && <CheckCircle className="size-3 shrink-0" />}
        {(state === 'error' || state === 'empty') && <AlertCircle className="size-3 shrink-0" />}
        {state === 'idle' && <Upload className="size-3 shrink-0" />}
        <span className="truncate">
          {state === 'idle'    && (label ?? 'Import file')}
          {state === 'loading' && 'Reading…'}
          {state === 'success' && (summary || 'Imported')}
          {state === 'empty'   && 'No data found'}
          {state === 'error'   && 'Error reading file'}
        </span>
        {state === 'success' && (
          <span
            onClick={e => { e.preventDefault(); setState('idle'); setSummary('') }}
            className="ml-auto underline underline-offset-2 hover:text-foreground shrink-0"
          >
            ×
          </span>
        )}
      </label>
    )
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn(
        'relative rounded-xl border-2 border-dashed transition-colors px-6 py-4',
        dragging
          ? 'border-blue-600 bg-blue-600/10'
          : state === 'success'
            ? 'border-green-500/40 bg-green-500/5'
            : state === 'error' || state === 'empty'
              ? 'border-red-500/40 bg-red-500/5'
              : 'border-border hover:border-blue-600/40 hover:bg-blue-600/5'
      )}
    >
      <label className="flex items-center gap-4 cursor-pointer">
        <input
          type="file"
          accept=".gcode,.g,.3mf"
          className="sr-only"
          onChange={onFile}
        />

        <div className="shrink-0">
          {state === 'loading'  && <Loader2 className="size-5 text-blue-600 animate-spin" />}
          {state === 'success'  && <CheckCircle className="size-5 text-green-500" />}
          {(state === 'error' || state === 'empty') && <AlertCircle className="size-5 text-red-400" />}
          {(state === 'idle')   && <Upload className="size-5 text-muted-foreground" />}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">
            {state === 'idle'    && 'Import from Bambu Studio / slicer'}
            {state === 'loading' && 'Reading file…'}
            {state === 'success' && 'Fields auto-filled from slicer'}
            {state === 'empty'   && 'No data found — try a sliced .gcode'}
            {state === 'error'   && 'Error reading file'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {state === 'idle'
              ? 'Drop a .gcode or .3mf file here, or click to browse'
              : summary}
          </p>
        </div>

        {state === 'success' && (
          <span
            onClick={e => { e.preventDefault(); setState('idle'); setSummary('') }}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground shrink-0"
          >
            clear
          </span>
        )}
      </label>
    </div>
  )
}
