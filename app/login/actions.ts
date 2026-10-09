'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import {
  ADMIN_COOKIE,
  ADMIN_COOKIE_OPTIONS,
  isAllowedAdmin,
  normaliseEmail,
  signAdminCookie,
} from '@/lib/admin-auth'

// Supabase sends and checks the one-time codes; this app decides who is allowed in.
function auth() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or key. See the README.')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }).auth
}

const safeNext = (n: string) => (n.startsWith('/') && !n.startsWith('//') ? n : '/admin')

export async function sendCode(rawEmail: string): Promise<{ error?: string }> {
  const email = normaliseEmail(rawEmail)
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'Type your email address.' }
  // Same answer whether or not the email is on the list, so nobody can probe it.
  if (await isAllowedAdmin(email)) {
    const { error } = await auth().signInWithOtp({ email, options: { shouldCreateUser: true } })
    if (error) {
      return {
        error: /rate|seconds|too many/i.test(error.message)
          ? 'A code was just sent. Wait a minute, then try again.'
          : 'The code could not be sent. Try again in a minute.',
      }
    }
  }
  return {}
}

export async function verifyCode(rawEmail: string, code: string, next: string): Promise<{ error?: string }> {
  const email = normaliseEmail(rawEmail)
  const token = code.replace(/\s+/g, '')
  if (!/^\d{4,10}$/.test(token)) return { error: 'The code is the numbers in the email.' }
  if (!(await isAllowedAdmin(email))) return { error: 'That code did not work. Ask for a new one.' }
  const { error } = await auth().verifyOtp({ email, token, type: 'email' })
  if (error) return { error: 'That code did not work. Ask for a new one.' }
  ;(await cookies()).set(ADMIN_COOKIE, signAdminCookie(email), ADMIN_COOKIE_OPTIONS)
  redirect(safeNext(next))
}

export async function signOut() {
  ;(await cookies()).delete(ADMIN_COOKIE)
  redirect('/')
}
