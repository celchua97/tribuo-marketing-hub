import { ageLabel, addDays, dueLabel, dueState, formatWeekday, todayIn } from './dates'
import type { Plate } from './board'
import { MARKET_NAME } from './labels'
import type { OpenComments, Profile, ShootDayWithNames, VideoWithNames } from './types'

// Plain text that pastes cleanly into WhatsApp. A real WhatsApp or Telegram
// integration can send these same strings later.

const ep = (v: VideoWithNames) => (v.episode_number ? ` (Ep ${v.episode_number})` : '')

export function shootReminder(day: ShootDayWithNames, shots: VideoWithNames[]) {
  const where = day.studio?.name ? `${day.studio.name}, ` : ''
  const lines = [`Shoot reminder: ${formatWeekday(day.shoot_date)}, ${where}${MARKET_NAME[day.market]}`]
  if (shots.length === 0) {
    lines.push('No shots planned yet.')
  } else {
    lines.push(`Shots (${shots.length}):`)
    shots.forEach((v, i) => lines.push(`${i + 1}. ${v.title}${ep(v)}`))
    lines.push('', 'Please tap Shot or Skipped on every item, then close the day.')
  }
  return lines.join('\n')
}

function section(title: string, items: string[]) {
  return items.length ? ['', `${title} (${items.length}):`, ...items.map((i) => `- ${i}`)] : []
}

export function buildNudge(me: Profile, plate: Plate, openComments: OpenComments, timeZone: string) {
  const today = todayIn(timeZone)
  const first = me.full_name.split(' ')[0]
  const lines: string[] = []

  if (plate.role === 'lead') {
    lines.push(`Hi ${first}, here's your Tribuo content list for ${formatWeekday(today)}.`)
    const body = [
      ...section(
        'Follow up',
        plate.followUps.map((f) => {
          const bits: string[] = []
          const late = f.overdueVideos.length + f.overdueDays.length
          if (late) bits.push(`${late} overdue`)
          if (f.quiet) bits.push(f.lastActive ? `no update for ${f.quietDays} days` : 'no updates yet')
          return `${f.person.full_name}: ${bits.join(', ')}`
        }),
      ),
      ...section('Waiting for your approval', plate.approvals.map((v) => `${v.title} (${v.market}): ${ageLabel(v.status_changed_at).toLowerCase()}`)),
      ...section('Questions from the editor', plate.questions.map((v) => `${v.title} (${v.market})`)),
      ...section('Not on a Shoot Day yet', plate.unscheduled.map((v) => `${v.title} (${v.market})${v.skip_reason ? `, skipped: ${v.skip_reason}` : ''}`)),
      ...section('Ready to post', plate.readyToPost.map((v) => `${v.title} (${v.market})`)),
    ]
    lines.push(...(body.length ? body : ['', 'Nothing is waiting on you today.']))
  } else if (plate.role === 'videographer') {
    lines.push(`Hi ${first}, here's your Tribuo shoot list for ${formatWeekday(today)}.`)
    const tomorrow = addDays(today, 1)
    const body: string[] = []
    for (const d of plate.days) {
      const when =
        d.shoot_date < today ? `Overdue, not closed: ${formatWeekday(d.shoot_date)}` : d.shoot_date === today ? 'Today' : d.shoot_date === tomorrow ? 'Tomorrow' : formatWeekday(d.shoot_date)
      const where = d.studio?.name ? `, ${d.studio.name}` : ''
      const shots = plate.shots[d.id] ?? []
      body.push('', `${when}${where} (${d.market}), ${shots.length} shot${shots.length === 1 ? '' : 's'}:`)
      shots.forEach((v, i) => body.push(`${i + 1}. ${v.title}${ep(v)}`))
    }
    lines.push(...(body.length ? body : ['', 'No Shoot Days planned yet.']))
  } else {
    lines.push(`Hi ${first}, here's your Tribuo edit list for ${formatWeekday(today)}.`)
    const label = (v: VideoWithNames) => {
      const n = openComments[v.id]?.open ?? 0
      const bits = [v.status === 'changes_requested' ? `${n} comment${n === 1 ? '' : 's'} to fix` : 'new edit']
      if (v.due_on) bits.push(dueLabel(v.due_on, timeZone).toLowerCase())
      return `${v.title} (${v.market}): ${bits.join(', ')}`
    }
    const overdue = plate.tasks.filter((v) => dueState(v.due_on, timeZone) === 'overdue')
    const dueToday = plate.tasks.filter((v) => dueState(v.due_on, timeZone) === 'today')
    const later = plate.tasks.filter((v) => !['overdue', 'today'].includes(dueState(v.due_on, timeZone)))
    const body = [
      ...section('Overdue', overdue.map(label)),
      ...section('Due today', dueToday.map(label)),
      ...section('Coming up', later.map(label)),
    ]
    lines.push(...(body.length ? body : ['', 'Nothing to edit today.']))
  }
  return lines.join('\n')
}
