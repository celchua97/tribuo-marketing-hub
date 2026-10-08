import { requireMe } from '@/lib/data'
import { loadBoard, SHOOT_DAY_WITH_NAMES } from '@/lib/board'
import { addDays, formatWeekday, todayIn } from '@/lib/dates'
import { MARKET_FLAG, MARKET_NAME } from '@/lib/labels'
import { shootReminder } from '@/lib/nudge'
import type { Market, Profile, ShootDayWithNames, Studio } from '@/lib/types'
import { ActionForm, SubmitButton } from '@/components/action-form'
import { CopyButton } from '@/components/copy-button'
import { PageBand } from '@/components/top-bar'
import { ShootDayCard } from '@/components/shoot-day-card'
import Link from 'next/link'
import { createShootDay } from '../actions'

export default async function ShootDaysPage() {
  const { supabase, me } = await requireMe()
  const tz = me.timezone
  const [board, closed, studios, videographers] = await Promise.all([
    loadBoard(supabase),
    supabase
      .from('shoot_days')
      .select(SHOOT_DAY_WITH_NAMES)
      .not('closed_at', 'is', null)
      .order('shoot_date', { ascending: false })
      .limit(8)
      .returns<ShootDayWithNames[]>(),
    supabase.from('studios').select('*').eq('active', true).order('name').returns<Studio[]>(),
    supabase.from('profiles').select('id, full_name').eq('role', 'videographer').eq('active', true).returns<Pick<Profile, 'id' | 'full_name'>[]>(),
  ])
  const shotsOn = (id: string) => board.videos.filter((v) => v.shoot_day_id === id && v.status === 'to_shoot')
  const next = board.days[0]

  return (
    <>
      <PageBand title="Shoot days" />
      <main className="mx-auto max-w-2xl space-y-8 px-4 py-6">
        {board.days.length === 0 ? (
          <div className="card text-center text-grey">No Shoot Days coming up.</div>
        ) : (
          <section className="space-y-3">
            <h2 className="label-caps text-xs text-grey">Coming up</h2>
            {board.days.map((d) => (
              <ShootDayCard key={d.id} day={d} shots={shotsOn(d.id)} timeZone={tz} />
            ))}
            {next && <CopyButton text={shootReminder(next, shotsOn(next.id))} label="Copy reminder for the next shoot" />}
          </section>
        )}

        {me.role === 'lead' && (
          <section id="new" className="card space-y-4">
            <h2 className="label-caps text-xs text-grey">Plan a Shoot Day</h2>
            <ActionForm action={createShootDay} className="space-y-4">
              <div>
                <label className="label" htmlFor="shoot_date">
                  Date
                </label>
                <input
                  id="shoot_date"
                  name="shoot_date"
                  type="date"
                  required
                  defaultValue={addDays(todayIn(tz), 1)}
                  className="field"
                />
              </div>
              <div>
                <span className="label">Market</span>
                <div className="flex gap-2">
                  {(['MY', 'KH'] as Market[]).map((m, i) => (
                    <label key={m} className="flex-1 cursor-pointer">
                      <input type="radio" name="market" value={m} defaultChecked={i === 0} className="peer sr-only" />
                      <span className="chip w-full justify-center peer-checked:border-blue peer-checked:bg-blue peer-checked:text-white">
                        {MARKET_FLAG[m]} {MARKET_NAME[m]}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="label" htmlFor="studio_id">
                  Studio
                </label>
                <select id="studio_id" name="studio_id" className="field" defaultValue="">
                  <option value="">Not decided yet</option>
                  {(studios.data ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.market} · {s.name}
                    </option>
                  ))}
                </select>
              </div>
              {(videographers.data ?? []).length > 1 && (
                <div>
                  <label className="label" htmlFor="videographer_id">
                    Videographer
                  </label>
                  <select id="videographer_id" name="videographer_id" className="field" defaultValue="">
                    <option value="">Choose automatically</option>
                    {(videographers.data ?? []).map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <SubmitButton pendingText="Creating…">Create Shoot Day</SubmitButton>
            </ActionForm>
          </section>
        )}

        {(closed.data ?? []).length > 0 && (
          <section className="space-y-3">
            <h2 className="label-caps text-xs text-grey">Closed</h2>
            <ul className="card divide-y divide-beige !py-2">
              {(closed.data ?? []).map((d) => (
                <li key={d.id}>
                  <Link href={`/shoot-days/${d.id}`} className="flex items-center justify-between gap-3 py-3">
                    <span className="font-bold">{formatWeekday(d.shoot_date)}</span>
                    <span className="text-sm text-grey">
                      {MARKET_FLAG[d.market]} {d.studio?.name ?? MARKET_NAME[d.market]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  )
}
