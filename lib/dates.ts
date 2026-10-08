export type DueState = 'overdue' | 'today' | 'upcoming' | 'none'

// YYYY-MM-DD for "today" in a given timezone
export function todayIn(timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date())
}

export function dueState(dueOn: string | null, timeZone: string): DueState {
  if (!dueOn) return 'none'
  const today = todayIn(timeZone)
  if (dueOn < today) return 'overdue'
  if (dueOn === today) return 'today'
  return 'upcoming'
}

export function daysBetween(fromIso: string, toIso: string) {
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000)
}

export function formatDate(isoDate: string) {
  // isoDate is a plain date (YYYY-MM-DD); format without shifting timezones
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, d)),
  )
}

export function formatDateTime(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(new Date(iso))
}

export function dueLabel(dueOn: string, timeZone: string) {
  const days = daysBetween(todayIn(timeZone), dueOn)
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  if (days === -1) return 'Due yesterday'
  if (days < 0) return `${-days} days overdue`
  return `Due ${formatDate(dueOn)}`
}

export function addDays(isoDate: string, n: number) {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

// "Thu 9 Oct" from a plain date
export function formatWeekday(isoDate: string) {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)))
}

export function hoursSince(iso: string) {
  return (Date.now() - Date.parse(iso)) / 3_600_000
}

export type Age = 'fresh' | 'amber' | 'late'

// Neutral under 24 hours, amber from 24 to 48, red over 48.
export function ageState(iso: string): Age {
  const h = hoursSince(iso)
  return h < 24 ? 'fresh' : h < 48 ? 'amber' : 'late'
}

export function ageLabel(iso: string) {
  const h = hoursSince(iso)
  if (h < 24) return `Waiting ${Math.max(1, Math.floor(h))}h`
  const days = Math.floor(h / 24)
  return `Waiting ${days} day${days === 1 ? '' : 's'}`
}
