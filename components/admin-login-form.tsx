'use client'

import { useState } from 'react'
import { sendCode, signInWithPasscode, verifyCode } from '@/app/login/actions'

export function AdminLoginForm({ next, passcodeEnabled }: { next: string; passcodeEnabled: boolean }) {
  const [step, setStep] = useState<'email' | 'code' | 'passcode'>('email')
  const [pass, setPass] = useState('')
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

  async function usePass(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const res = await signInWithPasscode(email, pass, next)
    setBusy(false)
    if (res?.error) setError(res.error)
  }

  if (step === 'passcode') {
    return (
      <form onSubmit={usePass} className="space-y-4">
        <div>
          <label className="label" htmlFor="admin_email2">Your email</label>
          <input id="admin_email2" type="email" autoComplete="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="admin_pass">Backup passcode</label>
          <input id="admin_pass" type="password" autoComplete="current-password" className="field" value={pass} onChange={(e) => setPass(e.target.value)} required />
        </div>
        {error && <p role="alert" className="text-sm font-bold text-danger">{error}</p>}
        <button className="btn-primary" disabled={busy}>{busy ? 'Checking…' : 'Sign in'}</button>
        <button type="button" className="text-sm font-bold text-grey underline" onClick={() => { setStep('email'); setError('') }}>Back to the email code</button>
      </form>
    )
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
      {passcodeEnabled && (
        <button type="button" className="text-sm font-bold text-grey underline" onClick={() => { setStep('passcode'); setError('') }}>
          No email? Use the backup passcode
        </button>
      )}
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
