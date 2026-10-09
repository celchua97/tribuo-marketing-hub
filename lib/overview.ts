import type { SupabaseClient } from '@supabase/supabase-js'
import { loadBoard, plateFor, type FollowUp } from './board'
import { addDays, dueState, todayIn } from './dates'
import type { Profile, VideoStatus, VideoWithNames } from './types'

type TodoRow = {
  id: string
  section_id: string
  title: string
  done: boolean
  done_at: string | null
  due_on: string | null
  created_at: string
  assignee_id: string | null
  assignee: { full_name: string } | null
  done_by_profile: { full_name: string } | null
}
type EventRow = {
  id: string
  kind: string
  to_status: VideoStatus | null
  payload: Record<string, unknown>
  created_at: string
  actor: { full_name: string } | null
  video: { title: string } | null
}

export type Activity = { at: string; who: string; text: string; what: string }

export async function loadOverview(supabase: SupabaseClient, me: Profile) {
  const tz = me.timezone
  const [sections, todos, board, posted, events] = await Promise.all([
    supabase.from('todo_sections').select('id, name').order('sort_order').returns<{ id: string; name: string }[]>(),
    supabase
      .from('todo_items')
      .select(
        'id, section_id, title, done, done_at, due_on, created_at, assignee_id, assignee:profiles!todo_items_assignee_id_fkey(full_name), done_by_profile:profiles!todo_items_done_by_fkey(full_name)',
      )
      .returns<TodoRow[]>(),
    loadBoard(supabase),
    supabase.from('videos').select('id', { count: 'exact', head: true }).eq('status', 'posted'),
    supabase
      .from('video_events')
      .select('id, kind, to_status, payload, created_at, actor:profiles!video_events_actor_id_fkey(full_name), video:videos(title)')
      .order('created_at', { ascending: false })
      .limit(8)
      .returns<EventRow[]>(),
  ])

  const items = todos.data ?? []
  const open = items.filter((i) => !i.done)
  const overdue = open
    .filter((i) => dueState(i.due_on, tz) === 'overdue')
    .sort((a, b) => (a.due_on ?? '').localeCompare(b.due_on ?? ''))
  const dueToday = open.filter((i) => dueState(i.due_on, tz) === 'today')

  const lists = (sections.data ?? []).map((s) => {
    const mine = items.filter((i) => i.section_id === s.id)
    const done = mine.filter((i) => i.done).length
    return { id: s.id, name: s.name, total: mine.length, done, open: mine.length - done }
  })
  const listName = Object.fromEntries(lists.map((l) => [l.id, l.name]))

  // Open to-dos per person, plus the ones nobody has been given
  const perPerson = new Map<string, { name: string; open: number; overdue: number }>()
  let unassigned = 0
  for (const i of open) {
    if (!i.assignee_id || !i.assignee) {
      unassigned += 1
      continue
    }
    const row = perPerson.get(i.assignee_id) ?? { name: i.assignee.full_name, open: 0, overdue: 0 }
    row.open += 1
    if (dueState(i.due_on, tz) === 'overdue') row.overdue += 1
    perPerson.set(i.assignee_id, row)
  }

  // The content workflow, read as the Head of Marketing sees it
  const plate = plateFor({ ...me, role: 'lead' }, board)
  const lead = plate.role === 'lead' ? plate : null
  const stages: { status: VideoStatus; count: number }[] = (
    ['to_shoot', 'to_edit', 'in_review', 'changes_requested', 'approved'] as VideoStatus[]
  ).map((status) => ({ status, count: board.videos.filter((v: VideoWithNames) => v.status === status).length }))
  const overdueVideos = board.videos.filter((v) => dueState(v.due_on, tz) === 'overdue')

  // The last 7 days of ticks, against the 7 before, for the trend line
  const today = todayIn(tz)
  const dayOf = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(iso))
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13))
  const ticksOn: Record<string, number> = {}
  const addedOn: Record<string, number> = {}
  for (const i of items) {
    if (i.done && i.done_at) ticksOn[dayOf(i.done_at)] = (ticksOn[dayOf(i.done_at)] ?? 0) + 1
    addedOn[dayOf(i.created_at)] = (addedOn[dayOf(i.created_at)] ?? 0) + 1
  }
  const weekday = (d: string) => {
    const [y, m, dd] = d.split('-').map(Number)
    return new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, dd)))
  }
  const thisWeek = days.slice(7)
  const sum = (ds: string[], m: Record<string, number>) => ds.reduce((n, d) => n + (m[d] ?? 0), 0)
  const trend = {
    points: thisWeek.map((d) => ({ label: weekday(d), value: ticksOn[d] ?? 0 })),
    doneThisWeek: sum(thisWeek, ticksOn),
    doneLastWeek: sum(days.slice(0, 7), ticksOn),
    addedThisWeek: sum(thisWeek, addedOn),
  }

  const activity: Activity[] = [
    ...items
      .filter((i) => i.done && i.done_at)
      .map((i) => ({ at: i.done_at as string, who: i.done_by_profile?.full_name ?? 'Someone', text: 'ticked off', what: i.title })),
    ...(events.data ?? []).map((e) => ({
      at: e.created_at,
      who: e.actor?.full_name ?? 'Someone',
      text: eventVerb(e),
      what: e.video?.title ?? 'a video',
    })),
  ]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 8)

  return {
    today,
    trend,
    todo: {
      open: open.length,
      overdue: overdue.map((i) => ({ id: i.id, title: i.title, due: i.due_on as string, who: i.assignee?.full_name ?? null, list: listName[i.section_id] ?? '' })),
      dueToday: dueToday.length,
      unassigned,
      lists,
      people: [...perPerson.values()].sort((a, b) => b.open - a.open),
    },
    videos: {
      stages,
      posted: posted.count ?? 0,
      approvals: lead?.approvals.length ?? 0,
      unscheduled: lead?.unscheduled.length ?? 0,
      readyToPost: lead?.readyToPost.length ?? 0,
      overdue: overdueVideos.length,
      followUps: (lead?.followUps ?? []) as FollowUp[],
    },
    activity,
  }
}

function eventVerb(e: EventRow) {
  // eventText reads "<name> marked it shot"; here the title follows, so use the short verb
  const map: Partial<Record<VideoStatus, string>> = {
    to_shoot: 'planned',
    to_edit: 'marked as shot',
    in_review: 'sent for review',
    changes_requested: 'asked for changes on',
    approved: 'approved',
    posted: 'marked as posted',
  }
  if (e.kind === 'created') return 'added'
  if (e.kind === 'submitted') return 'pasted an edit for'
  if (e.kind === 'skipped') return 'skipped a shot for'
  if (e.kind === 'changes_requested') return 'left comments on'
  return (e.to_status && map[e.to_status]) || 'updated'
}
