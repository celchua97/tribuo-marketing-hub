'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireLead, requireMe } from '@/lib/data'
import { friendlyError } from '@/lib/labels'
import { looksLikeZip, slidesIdFromUrl, titlesFromPptx } from '@/lib/slides'

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
  const slides = text(formData, 'reference_link')
  if (slides && !/^https:\/\//i.test(slides)) return { error: 'Paste the full Google Slides link, starting with https://' }

  const { data, error } = await supabase.rpc('save_video', {
    p_actor: me.id,
    p_id: text(formData, 'id') || null,
    p_title: title,
    p_market: market,
    p_pillar_id: null,
    p_episode_number: episode ? Number(episode) : null,
    p_brief: null,
    p_reference_link: text(formData, 'reference_link') || null,
    p_target_post_date: null,
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
  redirect('/board')
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

// ---------------------------------------------------------------------------
// Shoot Days
// ---------------------------------------------------------------------------
export async function createShootDay(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, me } = await requireLead()
  const market = text(formData, 'market')
  const studioId = text(formData, 'studio_id') || null
  if (market !== 'MY' && market !== 'KH') return { error: 'Pick a market.' }
  if (!text(formData, 'shoot_date')) return { error: 'Pick a date.' }
  if (studioId) {
    const { data: studio } = await supabase.from('studios').select('market').eq('id', studioId).maybeSingle()
    if (studio && studio.market !== market) return { error: 'That studio is in the other market.' }
  }
  const { data, error } = await supabase.rpc('create_shoot_day', {
    p_actor: me.id,
    p_date: text(formData, 'shoot_date'),
    p_market: market,
    p_studio: studioId,
    p_videographer: text(formData, 'videographer_id') || null,
  })
  if (error) return { error: friendlyError(error.message) }
  revalidatePath('/', 'layout')
  redirect(`/shoot-days/${data}`)
}

export async function attachVideo(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, me } = await requireLead()
  const { error } = await supabase.rpc('attach_video', {
    p_actor: me.id,
    p_video_id: text(formData, 'video_id'),
    p_day_id: text(formData, 'day_id'),
  })
  return done(error)
}

export async function detachVideo(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, me } = await requireLead()
  const { error } = await supabase.rpc('detach_video', {
    p_actor: me.id,
    p_video_id: text(formData, 'video_id'),
  })
  return done(error)
}

export async function skipShot(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, me } = await requireMe()
  const { error } = await supabase.rpc('skip_shot', {
    p_actor: me.id,
    p_video_id: text(formData, 'video_id'),
    p_reason: text(formData, 'reason'),
  })
  return done(error)
}

export async function closeShootDay(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, me } = await requireMe()
  const { error } = await supabase.rpc('close_shoot_day', {
    p_actor: me.id,
    p_day_id: text(formData, 'day_id'),
  })
  return done(error)
}

export async function saveFootageLink(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, me } = await requireMe()
  const { error } = await supabase.rpc('save_footage_link', {
    p_actor: me.id,
    p_day_id: text(formData, 'day_id'),
    p_link: text(formData, 'footage_link'),
  })
  return done(error)
}

export async function addStudio(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, me } = await requireLead()
  const market = text(formData, 'market')
  if (market !== 'MY' && market !== 'KH') return { error: 'Pick a market.' }
  const { error } = await supabase.rpc('add_studio', {
    p_actor: me.id,
    p_name: text(formData, 'name'),
    p_market: market,
  })
  return done(error)
}

// ---------------------------------------------------------------------------
// Feedback checkboxes (called straight from the checkbox, so not form based)
// ---------------------------------------------------------------------------
export async function toggleComment(commentId: string, isDone: boolean): Promise<ActionState> {
  const { supabase, me } = await requireMe()
  const { error } = await supabase.rpc('resolve_comment', {
    p_actor: me.id,
    p_comment_id: commentId,
    p_done: isDone,
  })
  return done(error)
}

export async function flagComment(commentId: string, flag: boolean): Promise<ActionState> {
  const { supabase, me } = await requireMe()
  const { error } = await supabase.rpc('flag_comment', {
    p_actor: me.id,
    p_comment_id: commentId,
    p_flag: flag,
  })
  return done(error)
}

// ---------------------------------------------------------------------------
// Slides import: read the slide titles and add them as videos
// ---------------------------------------------------------------------------
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024
const MAX_DECK_BYTES = 40 * 1024 * 1024

export type SlidesResult = { error?: string; titles?: string[]; slides?: number; link?: string }

export async function extractSlides(formData: FormData): Promise<SlidesResult> {
  await requireLead()
  const link = text(formData, 'slides_url')
  const file = formData.get('file')
  let bytes: Uint8Array

  try {
    if (file instanceof File && file.size > 0) {
      if (!/\.pptx$/i.test(file.name)) {
        return { error: 'Choose a PowerPoint file ending in .pptx. In Google Slides: File, Download, Microsoft PowerPoint.' }
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        return { error: 'That file is over 4 MB. Paste the Google Slides link instead.' }
      }
      bytes = new Uint8Array(await file.arrayBuffer())
    } else if (link) {
      const id = slidesIdFromUrl(link)
      if (!id) return { error: 'That doesn’t look like a Google Slides link. It should contain /presentation/d/ and a long code.' }
      const base = process.env.SLIDES_EXPORT_BASE ?? 'https://docs.google.com'
      const res = await fetch(`${base}/presentation/d/${id}/export/pptx`, {
        redirect: 'follow',
        signal: AbortSignal.timeout(40_000),
      })
      const buf = new Uint8Array(await res.arrayBuffer())
      if (!res.ok || !looksLikeZip(buf)) {
        return {
          error:
            'We couldn’t open that deck. In Google Slides, tap Share and set “Anyone with the link” to Viewer. Or download it as PowerPoint and upload the file here.',
        }
      }
      if (buf.length > MAX_DECK_BYTES) return { error: 'That deck is very large. Try a shorter one.' }
      bytes = buf
    } else {
      return { error: 'Paste a Google Slides link, or choose a PowerPoint file.' }
    }

    const { titles, slides } = titlesFromPptx(bytes)
    if (titles.length === 0) return { error: 'We couldn’t find any slide titles in that deck.', slides }
    return { titles, slides, link }
  } catch {
    return { error: 'We couldn’t read that deck. Check the link, or try uploading it as a PowerPoint file.' }
  }
}

export async function addVideosFromSlides(input: {
  market: string
  titles: string[]
  link: string
}): Promise<{ error?: string; added?: number; skipped?: number }> {
  const { supabase, me } = await requireLead()
  if (input.market !== 'MY' && input.market !== 'KH') return { error: 'Pick a market first.' }
  const link = input.link.trim()
  if (link && !/^https:\/\//i.test(link)) return { error: 'The Slides link has to start with https://' }

  const key = (t: string) => t.toLowerCase().replace(/[\s\p{P}]+/gu, ' ').trim()
  const { data: existing } = await supabase.from('videos').select('title').eq('market', input.market)
  const taken = new Set((existing ?? []).map((v: { title: string }) => key(v.title)))

  let added = 0
  let skipped = 0
  for (const raw of input.titles.slice(0, 150)) {
    const title = raw.replace(/\s+/g, ' ').trim().slice(0, 140)
    if (!title) continue
    if (taken.has(key(title))) {
      skipped++
      continue
    }
    taken.add(key(title))
    const { error } = await supabase.rpc('save_video', {
      p_actor: me.id,
      p_id: null,
      p_title: title,
      p_market: input.market,
      p_pillar_id: null,
      p_episode_number: null,
      p_brief: null,
      p_reference_link: link || null,
      p_target_post_date: null,
    })
    if (error) {
      revalidatePath('/', 'layout')
      return { error: `${friendlyError(error.message)} (${added} added before that.)`, added, skipped }
    }
    added++
  }
  revalidatePath('/', 'layout')
  return { added, skipped }
}
