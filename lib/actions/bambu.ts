'use server'

import { createClient } from '@/lib/supabase/server'

const BAMBU_BASE = 'https://bambulab.com/api'
const BAMBU_API  = 'https://api.bambulab.com/v1'

// ── Public types ──────────────────────────────────────────────
export type BambuPrint = {
  id: string
  title: string
  deviceName: string
  deviceModel: string
  weightG: number
  printHours: number
  material: string
  startTime: string
  plateName: string
}

// ── Token storage helpers ─────────────────────────────────────
async function saveToken(token: string, email: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase
    .from('profiles')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ bambu_token: token, bambu_email: email } as any)
    .eq('id', user.id)
}

async function readToken(): Promise<{ token: string | null; email: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { token: null, email: null }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await supabase.from('profiles').select('bambu_token, bambu_email').eq('id', user.id).single() as any
  return { token: data?.bambu_token ?? null, email: data?.bambu_email ?? null }
}

// ── Auth: step 1 — email + password ─────────────────────────
export async function bambuConnect(account: string, password: string): Promise<
  | { type: 'ok' }
  | { type: 'verify' }          // 2-FA code required
  | { type: 'error'; msg: string }
> {
  try {
    const res = await fetch(`${BAMBU_BASE}/sign-in/form`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ account, password }),
      cache: 'no-store',
    })

    if (!res.ok) return { type: 'error', msg: `HTTP ${res.status}` }

    const data = await res.json() as Record<string, unknown>

    // 2FA required
    if (data.loginType === 'verifyCode' || data.loginType === 'tfa') {
      return { type: 'verify' }
    }

    const token = data.accessToken ?? data.token ?? data.jwt
    if (!token) {
      return { type: 'error', msg: String(data.message ?? data.error ?? 'No token in response') }
    }

    await saveToken(String(token), account)
    return { type: 'ok' }
  } catch (e) {
    return { type: 'error', msg: e instanceof Error ? e.message : 'Connection failed' }
  }
}

// ── Auth: step 2 — 2FA verification code ─────────────────────
export async function bambuVerify(account: string, code: string): Promise<
  | { type: 'ok' }
  | { type: 'error'; msg: string }
> {
  try {
    const res = await fetch(`${BAMBU_BASE}/sign-in/verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ account, code }),
      cache: 'no-store',
    })

    if (!res.ok) return { type: 'error', msg: `HTTP ${res.status}` }

    const data = await res.json() as Record<string, unknown>
    const token = data.accessToken ?? data.token ?? data.jwt
    if (!token) {
      return { type: 'error', msg: String(data.message ?? 'Verification failed') }
    }

    await saveToken(String(token), account)
    return { type: 'ok' }
  } catch (e) {
    return { type: 'error', msg: e instanceof Error ? e.message : 'Verification failed' }
  }
}

// ── Disconnect ────────────────────────────────────────────────
export async function bambuDisconnect() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await supabase.from('profiles').update({ bambu_token: null, bambu_email: null } as any).eq('id', user.id)
}

// ── Connection status ─────────────────────────────────────────
export async function getBambuStatus(): Promise<{ connected: boolean; email: string | null }> {
  const { token, email } = await readToken()
  return { connected: !!token, email }
}

// ── Print history ─────────────────────────────────────────────
export async function getBambuPrintHistory(limit = 30): Promise<
  | { ok: true; prints: BambuPrint[] }
  | { ok: false; reason: 'not_connected' | 'expired' | 'error'; msg?: string }
> {
  const { token } = await readToken()
  if (!token) return { ok: false, reason: 'not_connected' }

  try {
    const res = await fetch(`${BAMBU_API}/user-service/my/tasks?limit=${limit}`, {
      headers: { 'Authorization': `Bearer ${token}` },
      cache: 'no-store',
    })

    if (res.status === 401 || res.status === 403) {
      return { ok: false, reason: 'expired' }
    }
    if (!res.ok) {
      return { ok: false, reason: 'error', msg: `HTTP ${res.status}` }
    }

    const data = await res.json() as Record<string, unknown>
    const hits = (data.hits ?? data.records ?? []) as Record<string, unknown>[]

    const prints: BambuPrint[] = hits
      .filter(h => Number(h.status) === 4)          // 4 = completed successfully
      .map(h => {
        // Duration: prefer costTime (seconds), fall back to startTime/endTime delta
        const costSec = Number(h.costTime ?? h.timeCost ?? 0)
        let printHours = costSec > 0 ? costSec / 3600 : 0

        if (!printHours) {
          const start = h.startTime ? new Date(String(h.startTime)).getTime() : 0
          const end   = h.endTime   ? new Date(String(h.endTime)).getTime()   : 0
          if (start && end && end > start) printHours = (end - start) / 3_600_000
        }

        // Material: check direct field, then first AMS slot
        const ams = (h.amsDetailMapping ?? []) as Record<string, unknown>[]
        const material = String(
          h.material ?? h.filamentType ??
          ams[0]?.filamentType ?? ams[0]?.type ?? 'PLA'
        )

        return {
          id: String(h.id ?? crypto.randomUUID()),
          title: String(h.title ?? h.name ?? h.modelName ?? 'Untitled'),
          deviceName: String(h.deviceName ?? h.printerName ?? ''),
          deviceModel: String(h.deviceModel ?? ''),
          weightG: Number(h.weight ?? 0),
          printHours: parseFloat(printHours.toFixed(3)),
          material,
          startTime: String(h.startTime ?? h.createTime ?? ''),
          plateName: String(h.plateName ?? ''),
        }
      })

    return { ok: true, prints }
  } catch (e) {
    return { ok: false, reason: 'error', msg: e instanceof Error ? e.message : 'Request failed' }
  }
}
