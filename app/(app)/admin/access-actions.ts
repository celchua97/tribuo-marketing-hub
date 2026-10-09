'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ADMIN_COOKIE, envAdminEmails, normaliseEmail } from '@/lib/admin-auth'
import { requireLead } from '@/lib/data'
import type { ActionState } from '../actions'

const text = (f: FormData, k: string) => (typeof f.get(k) === 'string' ? (f.get(k) as string) : '')

export async function addAdminEmail(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, adminEmail } = await requireLead('/admin?section=access')
  const email = normaliseEmail(text(formData, 'email'))
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'That does not look like an email address.' }
  if (envAdminEmails().includes(email)) return { error: 'That email already has access.' }
  const { error } = await supabase.from('admin_emails').insert({ email, added_by: adminEmail })
  if (error) return { error: error.code === '23505' ? 'That email already has access.' : 'Could not add it. Try again.' }
  revalidatePath('/admin')
  return undefined
}

export async function removeAdminEmail(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, adminEmail } = await requireLead('/admin?section=access')
  const email = normaliseEmail(text(formData, 'email'))
  if (email === adminEmail) return { error: 'You cannot remove your own access.' }
  const { error } = await supabase.from('admin_emails').delete().eq('email', email)
  if (error) return { error: 'Could not remove it. Try again.' }
  revalidatePath('/admin')
  return undefined
}

export async function signOutAdmin(): Promise<ActionState> {
  ;(await cookies()).delete(ADMIN_COOKIE)
  redirect('/')
}
