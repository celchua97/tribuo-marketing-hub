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

export const STATUS_PILL: Record<VideoStatus, string> = {
  draft: 'bg-sand text-ink',
  to_shoot: 'bg-blue/10 text-blue',
  to_edit: 'bg-blue/10 text-blue',
  in_review: 'bg-coral/20 text-ink',
  changes_requested: 'bg-coral/20 text-ink',
  approved: 'bg-ink/5 text-ink',
  posted: 'bg-ink text-white',
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
  to_shoot: 'wrote the brief',
  draft: 'cleared the brief',
  to_edit: 'marked it shot',
  in_review: 'sent it for review',
  changes_requested: 'requested changes',
  approved: 'approved it',
  posted: 'marked it posted',
}

export function eventText(kind: string, to: VideoStatus | null, payload: Record<string, unknown>) {
  if (kind === 'created') return 'added the video'
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
