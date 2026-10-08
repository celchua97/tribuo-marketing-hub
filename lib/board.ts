import type { SupabaseClient } from '@supabase/supabase-js'
import { VIDEO_WITH_NAMES } from './data'
import type { OpenComments, Profile, ShootDayWithNames, VideoWithNames } from './types'

export const SHOOT_DAY_WITH_NAMES =
  '*, studio:studios(name), videographer:profiles!shoot_days_videographer_id_fkey(full_name)'

export type Board = {
  videos: VideoWithNames[] // everything not yet posted
  openComments: OpenComments
  days: ShootDayWithNames[] // Shoot Days that aren't closed, soonest first
}

export async function loadBoard(supabase: SupabaseClient): Promise<Board> {
  const [videos, comments, days] = await Promise.all([
    supabase
      .from('videos')
      .select(VIDEO_WITH_NAMES)
      .neq('status', 'posted')
      .order('due_on', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })
      .returns<VideoWithNames[]>(),
    supabase
      .from('feedback_comments')
      .select('video_id, needs_clarification')
      .is('resolved_at', null)
      .returns<{ video_id: string; needs_clarification: boolean }[]>(),
    supabase
      .from('shoot_days')
      .select(SHOOT_DAY_WITH_NAMES)
      .is('closed_at', null)
      .order('shoot_date', { ascending: true })
      .returns<ShootDayWithNames[]>(),
  ])

  const openComments: OpenComments = {}
  for (const c of comments.data ?? []) {
    const entry = (openComments[c.video_id] ??= { open: 0, flagged: false })
    entry.open += 1
    if (c.needs_clarification) entry.flagged = true
  }
  return { videos: videos.data ?? [], openComments, days: days.data ?? [] }
}

// What is on one person's plate, by role. The home screen and the WhatsApp
// nudge both read from this, so they can never disagree.
export type Plate =
  | {
      role: 'lead'
      approvals: VideoWithNames[]
      questions: VideoWithNames[]
      unscheduled: VideoWithNames[]
      readyToPost: VideoWithNames[]
      briefs: VideoWithNames[]
    }
  | { role: 'videographer'; days: ShootDayWithNames[]; shots: Record<string, VideoWithNames[]> }
  | { role: 'editor'; tasks: VideoWithNames[] }

export function plateFor(me: Profile, board: Board): Plate {
  const { videos, openComments, days } = board
  if (me.role === 'lead') {
    const byAge = (a: VideoWithNames, b: VideoWithNames) =>
      Date.parse(a.status_changed_at) - Date.parse(b.status_changed_at)
    return {
      role: 'lead',
      approvals: videos.filter((v) => v.status === 'in_review').sort(byAge),
      questions: videos.filter((v) => v.status === 'changes_requested' && openComments[v.id]?.flagged),
      unscheduled: videos.filter((v) => v.status === 'to_shoot' && !v.shoot_day_id),
      readyToPost: videos.filter((v) => v.status === 'approved'),
      briefs: videos.filter((v) => v.status === 'draft'),
    }
  }
  if (me.role === 'videographer') {
    const mine = days.filter((d) => !d.videographer_id || d.videographer_id === me.id)
    const shots: Record<string, VideoWithNames[]> = {}
    for (const d of mine) shots[d.id] = videos.filter((v) => v.shoot_day_id === d.id && v.status === 'to_shoot')
    return { role: 'videographer', days: mine, shots }
  }
  return {
    role: 'editor',
    tasks: videos.filter(
      (v) => (v.status === 'to_edit' || v.status === 'changes_requested') && v.assignee_id === me.id,
    ),
  }
}
