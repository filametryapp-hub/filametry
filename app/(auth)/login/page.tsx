'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GoogleButton } from '@/components/auth/google-button'

export default function LoginPage() {
  const router = useRouter()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="text-sm text-muted-foreground mt-1">Welcome back to Filametry.</p>
      </div>

      {/* Google */}
      <GoogleButton label="Sign in with Google" />

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Email + password */}
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Email</Label>
          <Input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Password</Label>
          <Input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 px-3 py-2 rounded-md">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-2.5 rounded-md text-sm font-medium transition-colors"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        No account?{' '}
        <Link href="/register" className="text-orange-500 hover:text-orange-400 transition-colors">
          Start free trial
        </Link>
      </p>
    </div>
  )
}
