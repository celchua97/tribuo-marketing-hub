import type { SupabaseClient } from '@supabase/supabase-js'
import { VIDEO_WITH_NAMES } from './data'
import { dueState, hoursSince, todayIn } from './dates'
import type { OpenComments, Profile, ShootDayWithNames, VideoWithNames } from './types'

export const SHOOT_DAY_WITH_NAMES =
  '*, studio:studios(name), videographer:profiles!shoot_days_videographer_id_fkey(full_name)'

export type Board = {
  videos: VideoWithNames[] // everything not yet posted
  openComments: OpenComments
  days: ShootDayWithNames[] // Shoot Days that aren't closed, soonest first
  people: Profile[]
  lastActive: Record<string, string> // person id -> time of their latest update
}

export async function loadBoard(supabase: SupabaseClient): Promise<Board> {
  const [videos, comments, days, people, events, ticks] = await Promise.all([
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
    supabase.from('profiles').select('*').eq('active', true).order('created_at').returns<Profile[]>(),
    supabase
      .from('video_events')
      .select('actor_id, created_at')
      .order('created_at', { ascending: false })
      .limit(400)
      .returns<{ actor_id: string | null; created_at: string }[]>(),
    supabase
      .from('feedback_comments')
      .select('resolved_by, resolved_at')
      .not('resolved_at', 'is', null)
      .order('resolved_at', { ascending: false })
      .limit(100)
      .returns<{ resolved_by: string | null; resolved_at: string }[]>(),
  ])

  const openComments: OpenComments = {}
  for (const c of comments.data ?? []) {
    const entry = (openComments[c.video_id] ??= { open: 0, flagged: false })
    entry.open += 1
    if (c.needs_clarification) entry.flagged = true
  }
  // Every tap is recorded, so the latest one per person shows who has gone quiet.
  const lastActive: Record<string, string> = {}
  const note = (id: string | null, at: string) => {
    if (id && (!lastActive[id] || Date.parse(at) > Date.parse(lastActive[id]))) lastActive[id] = at
  }
  for (const e of events.data ?? []) note(e.actor_id, e.created_at)
  for (const t of ticks.data ?? []) note(t.resolved_by, t.resolved_at)

  return { videos: videos.data ?? [], openComments, days: days.data ?? [], people: people.data ?? [], lastActive }
}

// What is on one person's plate, by role. The home screen and the WhatsApp
// nudge both read from this, so they can never disagree.
// Someone the Head of Marketing may need to chase.
export type FollowUp = {
  person: Profile
  onPlate: number
  overdueVideos: VideoWithNames[]
  overdueDays: ShootDayWithNames[]
  lastActive: string | null
  quietDays: number | null // whole days since their last update, if they hold work
  quiet: boolean
}

// Two days with work on your plate and no update is worth a nudge.
const QUIET_AFTER_DAYS = 2

export type Plate =
  | {
      role: 'lead'
      approvals: VideoWithNames[]
      questions: VideoWithNames[]
      unscheduled: VideoWithNames[]
      readyToPost: VideoWithNames[]
      followUps: FollowUp[]
      teamCount: number // how many people are being watched
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
      ...followUpsFor(me, board),
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

function followUpsFor(me: Profile, board: Board) {
  const { videos, days, people, lastActive } = board
  const tz = me.timezone
  const today = todayIn(tz)
  const others = people.filter((p) => p.role !== 'lead')

  const all: FollowUp[] = others.map((person) => {
    const mine = videos.filter((v) => v.assignee_id === person.id)
    const myDays =
      person.role === 'videographer'
        ? days.filter((d) => !d.videographer_id || d.videographer_id === person.id)
        : []
    const overdueVideos =
      person.role === 'editor' ? mine.filter((v) => dueState(v.due_on, tz) === 'overdue') : []
    const overdueDays = myDays.filter((d) => d.shoot_date < today)
    const shots = myDays.reduce(
      (n, d) => n + videos.filter((v) => v.shoot_day_id === d.id && v.status === 'to_shoot').length,
      0,
    )
    const onPlate = person.role === 'editor' ? mine.length : shots
    const last = lastActive[person.id] ?? null
    const quietDays = last ? Math.floor(hoursSince(last) / 24) : null
    // Holding work and silent: either never updated, or nothing for a couple of days.
    const quiet = onPlate > 0 && (last === null || (quietDays ?? 0) >= QUIET_AFTER_DAYS)
    return { person, onPlate, overdueVideos, overdueDays, lastActive: last, quietDays, quiet }
  })

  return {
    followUps: all.filter((f) => f.overdueVideos.length + f.overdueDays.length > 0 || f.quiet),
    teamCount: others.length,
  }
}
