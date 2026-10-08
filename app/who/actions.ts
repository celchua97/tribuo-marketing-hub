'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { db } from '@/lib/supabase/admin'
import { PERSON_COOKIE, PERSON_COOKIE_OPTIONS } from '@/lib/session'
import { friendlyError } from '@/lib/labels'
import type { Profile } from '@/lib/types'
import type { ActionState } from '../(app)/actions'

function text(formData: FormData, key: string) {
  const v = formData.get(key)
  return typeof v === 'string' ? v.trim() : ''
}

// Tap your name on the list (new phone, or switching person).
export async function pickPerson(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = text(formData, 'person_id')
  const { data } = await db()
    .from('profiles')
    .select('id')
    .eq('id', id)
    .eq('active', true)
    .maybeSingle<Pick<Profile, 'id'>>()
  if (!data) return { error: 'That person isn’t on the team any more.' }
  ;(await cookies()).set(PERSON_COOKIE, data.id, PERSON_COOKIE_OPTIONS)
  redirect('/board')
}

// First time: a name and a colour. The colour is the role.
export async function joinTeam(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const role = text(formData, 'role')
  if (!['lead', 'videographer', 'editor'].includes(role)) return { error: 'Pick your colour.' }
  const { data, error } = await db().rpc('join_team', { p_name: text(formData, 'name'), p_role: role })
  if (error) return { error: friendlyError(error.message) }
  ;(await cookies()).set(PERSON_COOKIE, data as string, PERSON_COOKIE_OPTIONS)
  redirect('/board')
}
