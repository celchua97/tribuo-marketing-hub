'use server'

import { revalidatePath } from 'next/cache'
import { requireLead } from '@/lib/data'
import { friendlyError } from '@/lib/labels'
import type { ActionState } from '../actions'

function text(formData: FormData, key: string) {
  const v = formData.get(key)
  return typeof v === 'string' ? v.trim() : ''
}

function done(error?: { message: string } | null): ActionState {
  if (error) return { error: friendlyError(error.message) }
  revalidatePath('/admin')
  revalidatePath('/ideas', 'layout')
  return undefined
}

// Called straight from the status buttons
export async function setIdeaStatus(id: string, status: string): Promise<ActionState> {
  const { supabase, me } = await requireLead()
  const { error } = await supabase.rpc('idea_set_status', { p_actor: me.id, p_id: id, p_status: status })
  return done(error)
}
