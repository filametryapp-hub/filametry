'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GoogleButton } from '@/components/auth/google-button'

export default function RegisterPage() {
  const router = useRouter()
  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    })

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
        <h1 className="text-xl font-semibold">Start your free trial</h1>
        <p className="text-sm text-muted-foreground mt-1">7 days free. No credit card required.</p>
      </div>

      {/* Google — easiest path */}
      <GoogleButton label="Sign up with Google" />

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Email + password */}
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Full name</Label>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="John Smith"
            required
            autoComplete="name"
          />
        </div>

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
            placeholder="Min. 8 characters"
            required
            autoComplete="new-password"
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
          {loading ? 'Creating account…' : "Create account — it's free"}
        </button>
      </form>

      <div className="text-center space-y-3">
        <p className="text-xs text-muted-foreground">
          By signing up you agree to our Terms of Service and Privacy Policy.
        </p>
        <p className="text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="text-orange-500 hover:text-orange-400 transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
