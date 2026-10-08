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
