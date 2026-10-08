import { createClient } from '@supabase/supabase-js'

// Server-only. The secret key bypasses row security, which is locked to everyone
// else, so it must never reach the browser: no NEXT_PUBLIC_ prefix, and this file
// is only imported from server code.
export function db() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. See the README.')
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
