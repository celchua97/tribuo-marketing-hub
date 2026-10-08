import Link from 'next/link'
import { agoLabel, dueLabel, formatWeekday } from '@/lib/dates'
import { ROLE_COLOR, ROLE_LABEL } from '@/lib/labels'
import type { FollowUp } from '@/lib/board'
import type { Profile } from '@/lib/types'
import { CopyButton } from './copy-button'

// For the Head of Marketing: who is overdue or quiet, what is late, and a
// ready-made nudge. When everyone is fine it says so, so silence means "on track".
export function FollowUpSection({
  followUps,
  people,
  lastActive,
  nudges,
  timeZone,
}: {
  followUps: FollowUp[]
  people: Profile[]
  lastActive: Record<string, string>
  nudges: Record<string, string>
  timeZone: string
}) {
  const watched = people.filter((p) => p.role !== 'lead')
  if (watched.length === 0) return null

  return (
    <section className="space-y-3">
      <h2 className="label-caps flex flex-wrap items-center gap-2 text-xs text-grey">
        Follow up <span className="text-grey/70">({followUps.length})</span>
        {followUps.length > 0 && <span className="tag tag-salmon">Chase these</span>}
      </h2>

      {followUps.length === 0 ? (
        <div className="card !bg-sand">
          <p className="font-bold">Everyone is on track.</p>
          <p className="text-grey">Nothing is overdue and everyone has updated recently.</p>
        </div>
      ) : (
        followUps.map((f) => {
          const late = f.overdueVideos.length + f.overdueDays.length
          return (
            <div key={f.person.id} className="card space-y-3">
              <div className="flex items-center gap-2">
                <span className={`size-3 shrink-0 rounded-full ${ROLE_COLOR[f.person.role].dot}`} />
                <span className="title text-xl">{f.person.full_name}</span>
                <span className="label-caps text-[10px] text-grey">{ROLE_LABEL[f.person.role]}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {late > 0 && <span className="tag tag-salmon">{late} overdue</span>}
                {f.quiet && (
                  <span className="tag tag-yellow">
                    {f.lastActive ? `No update for ${f.quietDays} days` : 'No updates yet'}
                  </span>
                )}
                <span className="tag tag-cream">{f.onPlate} on their plate</span>
              </div>
              {(f.overdueVideos.length > 0 || f.overdueDays.length > 0) && (
                <ul className="divide-y divide-beige text-[15px]">
                  {f.overdueDays.map((d) => (
                    <li key={d.id}>
                      <Link href={`/shoot-days/${d.id}`} className="flex justify-between gap-3 py-2.5">
                        <span className="font-bold">Shoot on {formatWeekday(d.shoot_date)} not closed</span>
                        <span className="shrink-0 text-grey">{dueLabel(d.shoot_date, timeZone).toLowerCase()}</span>
                      </Link>
                    </li>
                  ))}
                  {f.overdueVideos.map((v) => (
                    <li key={v.id}>
                      <Link href={`/videos/${v.id}`} className="flex justify-between gap-3 py-2.5">
                        <span className="font-bold">{v.title}</span>
                        <span className="shrink-0 text-grey">
                          {v.due_on ? dueLabel(v.due_on, timeZone).toLowerCase() : ''}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-sm text-grey">
                Last update: {f.lastActive ? agoLabel(f.lastActive) : 'none yet'}
              </p>
              <CopyButton
                className="btn-ghost"
                label={`Copy a nudge for ${f.person.full_name.split(' ')[0]}`}
                text={nudges[f.person.id] ?? ''}
              />
            </div>
          )
        })
      )}

      <div className="card space-y-2 !py-4">
        <h3 className="label-caps text-xs text-grey">Last update from each person</h3>
        <ul className="space-y-1.5 text-[15px]">
          {watched.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <span className={`size-2.5 rounded-full ${ROLE_COLOR[p.role].dot}`} />
                <span className="font-bold">{p.full_name}</span>
              </span>
              <span className="text-grey">{lastActive[p.id] ? agoLabel(lastActive[p.id]) : 'no updates yet'}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
