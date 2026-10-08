export type Role = 'lead' | 'videographer' | 'editor'
export type Market = 'MY' | 'KH'
export type VideoStatus =
  | 'draft'
  | 'to_shoot'
  | 'to_edit'
  | 'in_review'
  | 'changes_requested'
  | 'approved'
  | 'posted'

export type Profile = {
  id: string
  email: string | null
  full_name: string
  role: Role
  market: Market | null
  timezone: string
  whatsapp_number: string | null
  active: boolean
}

export type Pillar = { id: string; name: string; sort_order: number; active: boolean }

export type BriefTemplate = {
  id: string
  name: string
  pillar_id: string | null
  brief: string
  sort_order: number
}

export type Video = {
  id: string
  title: string
  market: Market
  pillar_id: string | null
  episode_number: number | null
  brief: string | null
  reference_link: string | null
  target_post_date: string | null
  status: VideoStatus
  status_changed_at: string
  assignee_id: string | null
  due_on: string | null
  shoot_day_id: string | null
  editor_id: string | null
  shot_at: string | null
  latest_drive_link: string | null
  posted_link: string | null
  skip_reason: string | null
  skipped_at: string | null
  created_at: string
}

export type VideoWithNames = Video & {
  pillar: { name: string } | null
  assignee: { full_name: string } | null
}

export type Submission = {
  id: string
  round: number
  drive_link: string
  submitted_at: string
  submitter: { full_name: string } | null
}

export type FeedbackComment = {
  id: string
  submission_id: string | null
  timecode: string | null
  body: string
  position: number
  created_at: string
  resolved_at: string | null
  needs_clarification: boolean
}

export type VideoEvent = {
  id: number
  kind: string
  from_status: VideoStatus | null
  to_status: VideoStatus | null
  payload: Record<string, unknown>
  created_at: string
  actor: { full_name: string } | null
}

export type ShootDay = {
  id: string
  shoot_date: string
  market: Market
  studio_id: string | null
  videographer_id: string | null
  footage_link: string | null
  closed_at: string | null
}

export type ShootDayWithNames = ShootDay & {
  studio: { name: string } | null
  videographer: { full_name: string } | null
}

export type Studio = { id: string; name: string; market: Market; active: boolean }

// What the team sees about a video's open comments
export type OpenComments = Record<string, { open: number; flagged: boolean }>
