'use client'

import { useState, useEffect } from 'react'
import { X, RefreshCcw, ExternalLink, Clock, Weight } from 'lucide-react'
import { getBambuPrintHistory, type BambuPrint } from '@/lib/actions/bambu'

interface Props {
  onSelect: (print: BambuPrint) => void
  onClose: () => void
}

function fmtDate(iso: string) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

function fmtHours(h: number) {
  if (!h) return '—'
  const hrs = Math.floor(h)
  const mins = Math.round((h - hrs) * 60)
  if (hrs === 0) return `${mins}min`
  if (mins === 0) return `${hrs}h`
  return `${hrs}h ${mins}min`
}

export function BambuImportModal({ onSelect, onClose }: Props) {
  const [state, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'ok'; prints: BambuPrint[] }
    | { kind: 'not_connected' }
    | { kind: 'expired' }
    | { kind: 'error'; msg: string }
  >({ kind: 'loading' })

  async function load() {
    setState({ kind: 'loading' })
    const res = await getBambuPrintHistory(30)
    if (res.ok) {
      setState({ kind: 'ok', prints: res.prints })
    } else {
      setState({ kind: res.reason, msg: (res as { msg?: string }).msg ?? '' } as typeof state)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-background shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <svg className="size-5" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L4 6v12l8 4 8-4V6L12 2z" fill="#00AE42" opacity=".9" />
              <path d="M12 2v20M4 6l8 4 8-4" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <h2 className="text-base font-semibold">Histórico de Impressão — Bambu Lab</h2>
          </div>
          <div className="flex items-center gap-2">
            {state.kind === 'ok' && (
              <button onClick={load} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Atualizar">
                <RefreshCcw className="size-3.5" />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {state.kind === 'loading' && (
            <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
              <div className="size-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Carregando histórico…</span>
            </div>
          )}

          {state.kind === 'not_connected' && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-8">
              <svg className="size-10 opacity-40" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L4 6v12l8 4 8-4V6L12 2z" fill="#00AE42" />
              </svg>
              <p className="font-medium">Conta Bambu Lab não conectada</p>
              <p className="text-sm text-muted-foreground">Vá em Configurações para conectar sua conta Bambu Lab e importar o histórico de impressões.</p>
              <a href="/settings" className="flex items-center gap-1.5 text-sm text-green-500 hover:text-green-600 transition-colors mt-1">
                <ExternalLink className="size-3.5" /> Abrir Configurações
              </a>
            </div>
          )}

          {state.kind === 'expired' && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-8">
              <p className="font-medium">Sessão expirada</p>
              <p className="text-sm text-muted-foreground">Reconecte sua conta Bambu Lab nas Configurações.</p>
              <a href="/settings" className="flex items-center gap-1.5 text-sm text-green-500 hover:text-green-600 transition-colors">
                <ExternalLink className="size-3.5" /> Reconectar
              </a>
            </div>
          )}

          {state.kind === 'error' && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-8">
              <p className="font-medium text-red-400">Erro ao carregar histórico</p>
              <p className="text-xs text-muted-foreground font-mono">{(state as { msg: string }).msg}</p>
              <button onClick={load} className="text-sm text-blue-600 hover:text-blue-700 transition-colors">Tentar novamente</button>
            </div>
          )}

          {state.kind === 'ok' && state.prints.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-center px-8">
              <p className="font-medium">Nenhuma impressão concluída encontrada</p>
              <p className="text-sm text-muted-foreground">Impressões com status "Sucesso" aparecerão aqui.</p>
            </div>
          )}

          {state.kind === 'ok' && state.prints.length > 0 && (
            <div className="divide-y divide-border">
              {state.prints.map(print => (
                <button
                  key={print.id}
                  onClick={() => { onSelect(print); onClose() }}
                  className="w-full flex items-start gap-3 px-5 py-3.5 hover:bg-muted/50 transition-colors text-left group"
                >
                  {/* Green dot */}
                  <span className="mt-1 size-2 rounded-full bg-green-500 shrink-0" />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-blue-600 transition-colors">
                      {print.title || 'Sem título'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {print.deviceName}{print.plateName ? ` · ${print.plateName}` : ''}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Weight className="size-3" />
                        {print.weightG > 0 ? `${print.weightG.toFixed(1)}g` : '—'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {fmtHours(print.printHours)}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground/60">{fmtDate(print.startTime)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer hint */}
        {state.kind === 'ok' && state.prints.length > 0 && (
          <div className="px-5 py-3 border-t border-border shrink-0">
            <p className="text-xs text-muted-foreground">Clique em uma impressão para pré-preencher peso e tempo no calculador.</p>
          </div>
        )}
      </div>
    </div>
  )
}
