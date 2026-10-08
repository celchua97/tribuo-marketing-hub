// Browser-safe constants and types for the Idea Bank (no server code in here).
export const BUCKET = 'idea-attachments'
export const MAX_FILES = 3
export const MAX_FILE_BYTES = 5 * 1024 * 1024

export type Kind = 'idea' | 'feedback'
export type Status = 'new' | 'shortlisted' | 'used' | 'archived'

export const KINDS: { value: Kind; label: string; blurb: string; tag: string }[] = [
  { value: 'idea', label: 'Idea', blurb: 'Something we could try', tag: 'tag-yellow' },
  { value: 'feedback', label: 'Feedback', blurb: 'Something we should know', tag: 'tag-salmon' },
]
export const AREAS = ['Content', 'Social', 'Campaigns', 'Studios', 'Team'] as const
export const STATUSES: { value: Status; label: string; tag: string }[] = [
  { value: 'new', label: 'New', tag: 'tag-blue' },
  { value: 'shortlisted', label: 'Shortlisted', tag: 'tag-blue' },
  { value: 'used', label: 'Used', tag: 'tag-blue' },
  { value: 'archived', label: 'Archived', tag: 'tag-cream' },
]
export const kindInfo = (k: string) => KINDS.find((x) => x.value === k) ?? KINDS[0]
export const statusInfo = (s: string) => STATUSES.find((x) => x.value === s) ?? STATUSES[0]

// File types people can attach: screenshots and photos, PDF, Word, PowerPoint
export const DOC_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
export const ACCEPT = [...IMAGE_TYPES, ...DOC_TYPES].join(',')

export type IdeaDepartment = { id: string; name: string; sort_order: number; active: boolean }
export type IdeaPerson = {
  id: string
  name: string
  department_id: string | null
  created_at: string
  department: { name: string } | null
}
export type IdeaFile = {
  id: string
  path: string
  name: string
  mime: string
  size: number
  url?: string
  downloadUrl?: string
}
export type IdeaSubmission = {
  id: string
  person_id: string
  kind: Kind
  area: string
  title: string
  details: string | null
  status: Status
  created_at: string
  person: { name: string; department: { name: string } | null } | null
  files: IdeaFile[]
}

