import type { Market, Role, VideoStatus } from './types'

export const STATUS_LABEL: Record<VideoStatus, string> = {
  draft: 'Brief to write',
  to_shoot: 'To shoot',
  to_edit: 'Editing',
  in_review: 'Awaiting approval',
  changes_requested: 'Changes requested',
  approved: 'Approved, to post',
  posted: 'Posted',
}

// Blue: with the team or done. Yellow: waiting on Head of Marketing.
// Salmon: needs fixes. Cream: not started.
export const STATUS_PILL: Record<VideoStatus, string> = {
  draft: 'tag-cream',
  to_shoot: 'tag-blue',
  to_edit: 'tag-blue',
  in_review: 'tag-yellow',
  changes_requested: 'tag-salmon',
  approved: 'tag-yellow',
  posted: 'tag-blue',
}

export const MARKET_FLAG: Record<Market, string> = { MY: '🇲🇾', KH: '🇰🇭' }
export const MARKET_NAME: Record<Market, string> = { MY: 'Malaysia', KH: 'Cambodia' }

export const ROLE_LABEL: Record<Role, string> = {
  lead: 'Head of Marketing',
  videographer: 'Videographer',
  editor: 'Editor',
}

// Your colour is your role.
export const ROLE_COLOR: Record<Role, { dot: string; name: string }> = {
  lead: { dot: 'bg-ink', name: 'Black' },
  videographer: { dot: 'bg-blue', name: 'Blue' },
  editor: { dot: 'bg-coral', name: 'Coral' },
}

const EVENT_VERB: Partial<Record<VideoStatus, string>> = {
  to_shoot: 'planned it',
  to_edit: 'marked it shot',
  in_review: 'sent it for review',
  changes_requested: 'requested changes',
  approved: 'approved it',
  posted: 'marked it posted',
}

export function eventText(kind: string, to: VideoStatus | null, payload: Record<string, unknown>) {
  if (kind === 'created') return 'added the video'
  if (kind === 'skipped') return `skipped the shot (${String(payload.reason ?? 'no reason')})`
  if (kind === 'submitted') return `pasted the edit (version ${payload.round})`
  if (kind === 'changes_requested') {
    const n = Number(payload.comments)
    return `left ${n} comment${n === 1 ? '' : 's'}`
  }
  if (kind === 'status_changed' && to) return EVENT_VERB[to] ?? `moved it to ${STATUS_LABEL[to]}`
  return kind
}

// Database errors come back as "code: message". Show only the friendly part.
export function friendlyError(message: string) {
  const i = message.indexOf(': ')
  return i > -1 && /^[a-z_]+$/.test(message.slice(0, i)) ? message.slice(i + 2) : message
}

export const SKIP_REASONS = ['Talent no-show', 'Ran out of time', 'Location unavailable', 'Will reshoot'] as const
