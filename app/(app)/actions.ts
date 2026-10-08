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
// Videos (Head of Marketing only; the database checks this too)
// ---------------------------------------------------------------------------
export async function saveVideo(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, me } = await requireLead()
  const episode = text(formData, 'episode_number')
  const market = text(formData, 'market')
  const title = text(formData, 'title')
  if (!title) return { error: 'Add a title.' }
  if (market !== 'MY' && market !== 'KH') return { error: 'Pick a market.' }
  if (episode && !(Number(episode) > 0)) return { error: 'Episode number must be a positive number.' }

  const { data, error } = await supabase.rpc('save_video', {
    p_actor: me.id,
    p_id: text(formData, 'id') || null,
    p_title: title,
    p_market: market,
    p_pillar_id: text(formData, 'pillar_id') || null,
    p_episode_number: episode ? Number(episode) : null,
    p_brief: text(formData, 'brief') || null,
    p_reference_link: text(formData, 'reference_link') || null,
    p_target_post_date: text(formData, 'target_post_date') || null,
  })
  if (error) return { error: friendlyError(error.message) }

  revalidatePath('/', 'layout')
  redirect(`/videos/${data}`)
}

export async function deleteVideo(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, me } = await requireLead()
  const { error } = await supabase.rpc('delete_video', {
    p_actor: me.id,
    p_video_id: text(formData, 'video_id'),
  })
  if (error) return { error: friendlyError(error.message) }
  revalidatePath('/', 'layout')
  redirect('/')
}

// ---------------------------------------------------------------------------
// Chain transitions
// ---------------------------------------------------------------------------
export async function markShot(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, me } = await requireMe()
  const { error } = await supabase.rpc('mark_shot', {
    p_actor: me.id,
    p_video_id: text(formData, 'video_id'),
  })
  return done(error)
}

export async function submitForReview(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, me } = await requireMe()
  const { error } = await supabase.rpc('submit_for_review', {
    p_actor: me.id,
    p_video_id: text(formData, 'video_id'),
    p_drive_link: text(formData, 'drive_link'),
  })
  return done(error)
}

export async function approveVideo(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, me } = await requireMe()
  const { error } = await supabase.rpc('approve_video', {
    p_actor: me.id,
    p_video_id: text(formData, 'video_id'),
  })
  return done(error)
}

export async function requestChanges(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, me } = await requireMe()
  let comments: unknown
  try {
    comments = JSON.parse(text(formData, 'comments') || '[]')
  } catch {
    return { error: 'Something went wrong reading your comments. Try again.' }
  }
  const { error } = await supabase.rpc('request_changes', {
    p_actor: me.id,
    p_video_id: text(formData, 'video_id'),
    p_comments: comments,
  })
  return done(error)
}

export async function markPosted(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, me } = await requireMe()
  const { error } = await supabase.rpc('mark_posted', {
    p_actor: me.id,
    p_video_id: text(formData, 'video_id'),
    p_posted_link: text(formData, 'posted_link') || null,
  })
  return done(error)
}

// ---------------------------------------------------------------------------
// Settings and team (Head of Marketing only)
// ---------------------------------------------------------------------------
export async function saveSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, me } = await requireLead()
  const { error } = await supabase.rpc('save_settings', {
    p_actor: me.id,
    p_edit: Number(text(formData, 'edit_due_days')),
    p_approval: Number(text(formData, 'approval_due_days')),
    p_revision: Number(text(formData, 'revision_due_days')),
  })
  return done(error)
}

export async function updatePerson(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, me } = await requireLead()
  const market = text(formData, 'market')
  const { error } = await supabase.rpc('update_person', {
    p_actor: me.id,
    p_person: text(formData, 'person_id'),
    p_market: market === 'MY' || market === 'KH' ? market : null,
    p_active: text(formData, 'active') !== 'false',
  })
  return done(error)
}
