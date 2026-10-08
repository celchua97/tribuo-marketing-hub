'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireLead, requireMe } from '@/lib/data'
import { friendlyError } from '@/lib/labels'

export type ActionState = { error?: string } | undefined

function text(formData: FormData, key: string) {
  const v = formData.get(key)
  return typeof v === 'string' ? v.trim() : ''
}

function done(error?: { message: string } | null): ActionState {
  if (error) return { error: friendlyError(error.message) }
  revalidatePath('/', 'layout')
  return undefined
}

// ---------------------------------------------------------------------------
// Videos (Celine only)
// ---------------------------------------------------------------------------
export async function saveVideo(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireLead()
  const id = text(formData, 'id')
  const episode = text(formData, 'episode_number')
  const fields = {
    title: text(formData, 'title'),
    market: text(formData, 'market'),
    pillar_id: text(formData, 'pillar_id') || null,
    episode_number: episode ? Number(episode) : null,
    brief: text(formData, 'brief') || null,
    reference_link: text(formData, 'reference_link') || null,
    target_post_date: text(formData, 'target_post_date') || null,
  }
  if (!fields.title) return { error: 'Add a title.' }
  if (fields.market !== 'MY' && fields.market !== 'KH') return { error: 'Pick a market.' }
  if (fields.episode_number !== null && !(fields.episode_number > 0)) {
    return { error: 'Episode number must be a positive number.' }
  }

  const query = id
    ? supabase.from('videos').update(fields).eq('id', id).select('id').single()
    : supabase.from('videos').insert(fields).select('id').single()
  const { data, error } = await query
  if (error) return { error: friendlyError(error.message) }

  revalidatePath('/', 'layout')
  redirect(`/videos/${data.id}`)
}

export async function deleteVideo(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireLead()
  const { error } = await supabase.from('videos').delete().eq('id', text(formData, 'video_id'))
  if (error) return { error: friendlyError(error.message) }
  revalidatePath('/', 'layout')
  redirect('/')
}

// ---------------------------------------------------------------------------
// Chain transitions
// ---------------------------------------------------------------------------
export async function markShot(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireMe()
  const { error } = await supabase.rpc('mark_shot', { p_video_id: text(formData, 'video_id') })
  return done(error)
}

export async function submitForReview(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireMe()
  const { error } = await supabase.rpc('submit_for_review', {
    p_video_id: text(formData, 'video_id'),
    p_drive_link: text(formData, 'drive_link'),
  })
  return done(error)
}

export async function approveVideo(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireMe()
  const { error } = await supabase.rpc('approve_video', { p_video_id: text(formData, 'video_id') })
  return done(error)
}

export async function requestChanges(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireMe()
  let comments: unknown
  try {
    comments = JSON.parse(text(formData, 'comments') || '[]')
  } catch {
    return { error: 'Something went wrong reading your comments. Try again.' }
  }
  const { error } = await supabase.rpc('request_changes', {
    p_video_id: text(formData, 'video_id'),
    p_comments: comments,
  })
  return done(error)
}

export async function markPosted(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireMe()
  const { error } = await supabase.rpc('mark_posted', {
    p_video_id: text(formData, 'video_id'),
    p_posted_link: text(formData, 'posted_link') || null,
  })
  return done(error)
}

// ---------------------------------------------------------------------------
// Settings and team (Celine only)
// ---------------------------------------------------------------------------
export async function saveSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireLead()
  const { error } = await supabase
    .from('settings')
    .update({
      edit_due_days: Number(text(formData, 'edit_due_days')),
      approval_due_days: Number(text(formData, 'approval_due_days')),
      revision_due_days: Number(text(formData, 'revision_due_days')),
    })
    .eq('id', true)
  return done(error)
}

export async function inviteMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireLead()
  const email = text(formData, 'email').toLowerCase()
  const fullName = text(formData, 'full_name')
  const role = text(formData, 'role')
  const market = text(formData, 'market') || null
  if (!email.includes('@')) return { error: 'Add a valid email.' }
  if (!fullName) return { error: 'Add their name.' }
  if (!['lead', 'videographer', 'editor'].includes(role)) return { error: 'Pick a role.' }
  const { error } = await supabase
    .from('team_invites')
    .upsert({ email, full_name: fullName, role, market })
  return done(error)
}

export async function removeInvite(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireLead()
  const { error } = await supabase.from('team_invites').delete().eq('email', text(formData, 'email'))
  return done(error)
}
