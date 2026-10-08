import Link from 'next/link'
import { addDays, dueState, formatWeekday, todayIn } from '@/lib/dates'
import type { ShootDayWithNames, VideoWithNames } from '@/lib/types'
import { MarketFlag } from './badges'

// A Shoot Day on a list. Today's and tomorrow's shot lists are shown in full.
export function ShootDayCard({
  day,
  shots,
  timeZone,
}: {
  day: ShootDayWithNames
  shots: VideoWithNames[]
  timeZone: string
}) {
  const today = todayIn(timeZone)
  const state = dueState(day.shoot_date, timeZone)
  const tomorrow = day.shoot_date === addDays(today, 1)
  const soon = state === 'overdue' || state === 'today' || tomorrow
  const when = state === 'overdue' ? 'Not closed' : state === 'today' ? 'Today' : tomorrow ? 'Tomorrow' : null
  const whenStyle = state === 'overdue' ? 'tag-salmon' : 'tag-yellow'

  return (
    <Link
      href={`/shoot-days/${day.id}`}
      className={`card block transition active:scale-[0.99] ${soon ? '!bg-sand' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <MarketFlag market={day.market} />
            {day.studio && <span className="label-caps text-xs text-grey">{day.studio.name}</span>}
          </div>
          <p className="title mt-2 text-xl leading-tight">{formatWeekday(day.shoot_date)}</p>
        </div>
        <span aria-hidden className="mt-1 text-xl text-grey">
          ›
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {when && <span className={`tag ${whenStyle}`}>{when}</span>}
        <span className="tag tag-cream">
          {shots.length} shot{shots.length === 1 ? '' : 's'} to go
        </span>
        {day.videographer && <span className="text-xs text-grey">{day.videographer.full_name}</span>}
      </div>
      {soon && shots.length > 0 && (
        <ol className="mt-4 space-y-1.5 border-t border-beige pt-3 text-[15px]">
          {shots.map((v, i) => (
            <li key={v.id} className="flex gap-2">
              <span className="w-5 shrink-0 font-bold text-grey">{i + 1}</span>
              <span className="min-w-0">
                {v.title}
                {v.episode_number ? <span className="text-grey"> (Ep {v.episode_number})</span> : null}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Link>
  )
}
