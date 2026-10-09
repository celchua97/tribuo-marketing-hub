'use client'

import { useEffect } from 'react'
import { signInWithToken } from '@/app/login/actions'

// If someone opens the sign-in link from their email, Supabase sends them here with a
// token after the #. Use it once to sign them in, then clear it from the address bar.
export function AuthHashHandler() {
  useEffect(() => {
    const hash = window.location.hash
    if (!hash.includes('access_token=')) return
    const token = new URLSearchParams(hash.slice(1)).get('access_token') ?? ''
    history.replaceState(null, '', window.location.pathname + window.location.search)
    signInWithToken(token).then((res) => {
      window.location.replace(res.ok ? '/admin' : '/login?link=expired')
    })
  }, [])
  return null
}
