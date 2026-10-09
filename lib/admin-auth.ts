import { createHmac, timingSafeEqual } from 'node:crypto'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { db } from './supabase/admin'

// Admin sign-in is separate from "who are you". A person types their email, gets a
// one-time code, and if the email is on the allowed list they get a signed cookie.
export const ADMIN_COOKIE = 'tribuo_admin'
const MAX_AGE = 60 * 60 * 24 * 30
export const ADMIN_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: MAX_AGE,
}

// The platform owner. Always allowed in, and the only kind of admin who can give or take away access.
const OWNERS = ['celine.chuayq@gmail.com']

export function normaliseEmail(raw: string) {
  return raw.trim().toLowerCase()
}

const secret = () => process.env.ADMIN_SESSION_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const mac = (data: string) => createHmac('sha256', secret()).update(data).digest('base64url')

export function signAdminCookie(email: string) {
  const body = `${Buffer.from(email).toString('base64url')}.${Math.floor(Date.now() / 1000) + MAX_AGE}`
  return `${body}.${mac(body)}`
}

function emailFromCookie(value: string | undefined) {
  if (!value || !secret()) return null
  const [who, exp, sig] = value.split('.')
  if (!who || !exp || !sig) return null
  const want = Buffer.from(mac(`${who}.${exp}`))
  const got = Buffer.from(sig)
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null
  if (Number(exp) < Date.now() / 1000) return null
  return Buffer.from(who, 'base64url').toString()
}

// Emails set in Vercel as ADMIN_EMAILS (comma separated) always work, so you can never lock yourself out.
export function envAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map(normaliseEmail)
    .filter(Boolean)
}

export function ownerEmails() {
  const extra = (process.env.OWNER_EMAILS ?? '').split(',').map(normaliseEmail).filter(Boolean)
  return [...new Set([...OWNERS, ...extra, ...envAdminEmails()])]
}

export const isOwner = (email: string | null) => !!email && ownerEmails().includes(normaliseEmail(email))

export async function isAllowedAdmin(email: string) {
  const e = normaliseEmail(email)
  if (!e) return false
  if (isOwner(e)) return true
  const { data } = await db().from('admin_emails').select('email').eq('email', e).maybeSingle()
  return !!data
}

// The signed-in admin's email, or null. The list is checked every time, so removing
// someone locks them out straight away.
export const getAdminEmail = cache(async () => {
  const email = emailFromCookie((await cookies()).get(ADMIN_COOKIE)?.value)
  if (!email) return null
  return (await isAllowedAdmin(email)) ? email : null
})
