'use client'

import { useState } from 'react'
import { sendCode, verifyCode } from '@/app/login/actions'

export function AdminLoginForm({ next }: { next: string }) {
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function send(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const res = await sendCode(email)
    setBusy(false)
    if (res.error) return setError(res.error)
    setStep('code')
  }

  async function check(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const res = await verifyCode(email, code, next)
    // On success the server sends us to the next page; we only get here with an error.
    setBusy(false)
    if (res?.error) setError(res.error)
  }

  return step === 'email' ? (
    <form onSubmit={send} className="space-y-4">
      <div>
        <label className="label" htmlFor="admin_email">
          Your email
        </label>
        <input
          id="admin_email"
          type="email"
          autoComplete="email"
          className="field"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      {error && (
        <p role="alert" className="text-sm font-bold text-danger">
          {error}
        </p>
      )}
      <button className="btn-primary" disabled={busy}>
        {busy ? 'Sending…' : 'Email me a code'}
      </button>
    </form>
  ) : (
    <form onSubmit={check} className="space-y-4">
      <p className="text-grey">
        If <strong className="text-ink">{email}</strong> has admin access, a code is on its way. It can take a minute.
      </p>
      <div>
        <label className="label" htmlFor="admin_code">
          The code from the email
        </label>
        <input
          id="admin_code"
          inputMode="numeric"
          autoComplete="one-time-code"
          className="field tracking-[0.3em]"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={10}
          required
        />
      </div>
      {error && (
        <p role="alert" className="text-sm font-bold text-danger">
          {error}
        </p>
      )}
      <button className="btn-primary" disabled={busy || code.trim().length < 4}>
        {busy ? 'Checking…' : 'Sign in'}
      </button>
      <button type="button" className="text-sm font-bold text-grey underline" onClick={() => { setStep('email'); setCode(''); setError('') }}>
        Use a different email
      </button>
    </form>
  )
}
