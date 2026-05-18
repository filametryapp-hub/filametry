'use server'

import { createClient } from '@/lib/supabase/server'

const API = 'https://api.bambulab.com/v1'

// Headers that match what OrcaSlicer / Bambu Studio send — required to avoid 403
const BBL_HEADERS = {
  'Content-Type':          'application/json',
  'Accept':                'application/json',
  'Accept-Encoding':       'gzip, deflate',
  'User-Agent':            'bambu_network_agent/01.09.05.01',
  'X-BBL-Client-Name':     'OrcaSlicer',
  'X-BBL-Client-Type':     'slicer',
  'X-BBL-Client-Version':  '01.09.05.51',
  'X-BBL-Language':        'en-US',
  'X-BBL-OS-Type':         'linux',
  'X-BBL-OS-Version':      '6.2.0',
  'X-BBL-Agent-Version':   '01.09.05.01',
  'X-BBL-Executable-info': '{}',
  'X-BBL-Agent-OS-Type':   'linux',
}

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
  | { type: 'verify' }           // email verification code required
  | { type: 'tfa'; tfaKey: string } // TOTP 2FA required
  | { type: 'error'; msg: string }
> {
  try {
    const res = await fetch(`${API}/user-service/user/login`, {
      method: 'POST',
      headers: BBL_HEADERS,
      body: JSON.stringify({ account, password, apiError: '' }),
      cache: 'no-store',
    })

    const body = await res.text()
    let data: Record<string, unknown> = {}
    try { data = JSON.parse(body) } catch { /* non-JSON response */ }

    if (!res.ok) {
      return { type: 'error', msg: `HTTP ${res.status}: ${body.slice(0, 200)}` }
    }

    const loginType = data.loginType as string | undefined

    // Email verification code required
    if (loginType === 'verifyCode') {
      // Trigger the email — fire and forget (best effort)
      await fetch(`${API}/user-service/user/sendemail/code`, {
        method:  'POST',
        headers: BBL_HEADERS,
        body:    JSON.stringify({ email: account, type: 'codeLogin' }),
        cache:   'no-store',
      }).catch(() => {})
      return { type: 'verify' }
    }

    // TOTP / TFA required
    if (loginType === 'tfa') {
      const tfaKey = data.tfaKey as string | undefined
      if (!tfaKey) return { type: 'error', msg: 'TFA required but no tfaKey received.' }
      return { type: 'tfa', tfaKey }
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

// ── Auth: step 2a — email verification code ──────────────────
export async function bambuVerify(account: string, code: string): Promise<
  | { type: 'ok' }
  | { type: 'error'; msg: string }
> {
  try {
    // Same login endpoint — re-submit with code instead of password
    const res = await fetch(`${API}/user-service/user/login`, {
      method: 'POST',
      headers: BBL_HEADERS,
      body: JSON.stringify({ account, code }),
      cache: 'no-store',
    })

    const body = await res.text()
    let data: Record<string, unknown> = {}
    try { data = JSON.parse(body) } catch { /* non-JSON */ }

    if (!res.ok) {
      const msg = res.status === 400
        ? (data.code === 1 ? 'Código expirado.' : data.code === 2 ? 'Código incorreto.' : `HTTP 400: ${body.slice(0, 120)}`)
        : `HTTP ${res.status}`
      return { type: 'error', msg }
    }

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

// ── Auth: step 2b — TOTP / TFA code ─────────────────────────
export async function bambuTfa(tfaKey: string, tfaCode: string): Promise<
  | { type: 'ok' }
  | { type: 'error'; msg: string }
> {
  try {
    const res = await fetch('https://bambulab.com/api/sign-in/tfa', {
      method:  'POST',
      headers: BBL_HEADERS,
      body:    JSON.stringify({ tfaKey, tfaCode }),
      cache:   'no-store',
    })

    if (!res.ok) return { type: 'error', msg: `HTTP ${res.status}` }

    // TFA returns the token in a Set-Cookie header named "token"
    const setCookie = res.headers.get('set-cookie') ?? ''
    const match = setCookie.match(/(?:^|,)\s*token=([^;,]+)/)
    const cookieToken = match?.[1]

    // Also check JSON body just in case
    const text = await res.text()
    let data: Record<string, unknown> = {}
    try { data = JSON.parse(text) } catch { /* ok */ }
    const bodyToken = data.accessToken ?? data.token ?? data.jwt

    const token = cookieToken ?? bodyToken
    if (!token) return { type: 'error', msg: 'TFA completed but no token received.' }

    // We need the email — retrieve from Supabase (was set before TFA step)
    const { email } = await readToken()
    await saveToken(String(token), email ?? '')
    return { type: 'ok' }
  } catch (e) {
    return { type: 'error', msg: e instanceof Error ? e.message : 'TFA failed' }
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
    const res = await fetch(`${API}/user-service/my/tasks?limit=${limit}`, {
      headers: { ...BBL_HEADERS, 'Authorization': `Bearer ${token}` },
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
        const costSec = Number(h.costTime ?? h.timeCost ?? 0)
        let printHours = costSec > 0 ? costSec / 3600 : 0

        if (!printHours) {
          const start = h.startTime ? new Date(String(h.startTime)).getTime() : 0
          const end   = h.endTime   ? new Date(String(h.endTime)).getTime()   : 0
          if (start && end && end > start) printHours = (end - start) / 3_600_000
        }

        const ams = (h.amsDetailMapping ?? []) as Record<string, unknown>[]
        const material = String(
          h.material ?? h.filamentType ??
          ams[0]?.filamentType ?? ams[0]?.type ?? 'PLA'
        )

        return {
          id:         String(h.id ?? crypto.randomUUID()),
          title:      String(h.title ?? h.name ?? h.modelName ?? 'Untitled'),
          deviceName: String(h.deviceName ?? h.printerName ?? ''),
          deviceModel: String(h.deviceModel ?? ''),
          weightG:    Number(h.weight ?? 0),
          printHours: parseFloat(printHours.toFixed(3)),
          material,
          startTime:  String(h.startTime ?? h.createTime ?? ''),
          plateName:  String(h.plateName ?? ''),
        }
      })

    return { ok: true, prints }
  } catch (e) {
    return { ok: false, reason: 'error', msg: e instanceof Error ? e.message : 'Request failed' }
  }
}
