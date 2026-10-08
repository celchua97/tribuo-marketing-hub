'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const ERRORS: Record<string, string> = {
  link_expired: 'That link has expired or was already used. Request a new one below.',
  no_profile: 'Your account isn’t set up yet. Ask Celine to add you to the team.',
}

export function LoginForm({ initialError }: { initialError?: string }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(initialError ? (ERRORS[initialError] ?? initialError) : '')

  async function sendLink(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
    })
    setBusy(false)
    if (error) {
      setError(
        /database error|not_invited/i.test(error.message)
          ? 'That email isn’t on the team yet. Ask Celine to add you.'
          : error.message,
      )
      return
    }
    setSent(true)
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: 'email',
    })
    setBusy(false)
    if (error) {
      setError('That code didn’t work. Check it, or request a new link.')
      return
    }
    router.replace('/')
    router.refresh()
  }

  if (sent) {
    return (
      <div className="card space-y-4">
        <p className="font-semibold">Check your email</p>
        <p className="text-ink/70">
          We sent a sign-in link to <strong>{email}</strong>. Tap it on this device, or type the
          6-digit code from the email here.
        </p>
        <form onSubmit={verifyCode} className="space-y-3">
          <input
            className="field text-center text-2xl tracking-[0.4em]"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={10}
            placeholder="••••••"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
          <button className="btn-primary" disabled={busy || code.length < 6}>
            {busy ? 'Checking…' : 'Sign in with code'}
          </button>
        </form>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button className="text-sm text-blue underline" onClick={() => setSent(false)}>
          Use a different email
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={sendLink} className="card space-y-4">
      <div>
        <label className="label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          className="field"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <button className="btn-primary" disabled={busy}>
        {busy ? 'Sending…' : 'Send sign-in link'}
      </button>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </form>
  )
}
