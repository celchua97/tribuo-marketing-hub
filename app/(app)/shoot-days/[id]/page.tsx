import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireMe } from '@/lib/data'
import { SHOOT_DAY_WITH_NAMES } from '@/lib/board'
import { dueState, formatDateTime, formatWeekday } from '@/lib/dates'
import { MARKET_NAME } from '@/lib/labels'
import { shootReminder } from '@/lib/nudge'
import type { ShootDayWithNames, VideoWithNames } from '@/lib/types'
import { ActionForm, SubmitButton } from '@/components/action-form'
import { CopyButton } from '@/components/copy-button'
import { PasteLinkField } from '@/components/paste-link-field'
import { ShotButtons } from '@/components/skip-control'
import { MarketFlag } from '@/components/badges'
import { PageBand } from '@/components/top-bar'
import { VIDEO_WITH_NAMES } from '@/lib/data'
import { attachVideo, closeShootDay, detachVideo, saveFootageLink } from '../../actions'

type Skipped = { id: number; payload: { reason?: string }; video: { title: string } | null }

export default async function ShootDayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, me } = await requireMe()
  const tz = me.timezone

  const { data: day } = await supabase
    .from('shoot_days')
    .select(SHOOT_DAY_WITH_NAMES)
    .eq('id', id)
    .maybeSingle<ShootDayWithNames>()
  if (!day) notFound()

  const [attached, skipped, unscheduled] = await Promise.all([
    supabase.from('videos').select(VIDEO_WITH_NAMES).eq('shoot_day_id', id).order('created_at').returns<VideoWithNames[]>(),
    supabase
      .from('video_events')
      .select('id, payload, video:videos(title)')
      .eq('kind', 'skipped')
      .eq('payload->>shoot_day', id)
      .returns<Skipped[]>(),
    me.role === 'lead' && !day.closed_at
      ? supabase
          .from('videos')
          .select(VIDEO_WITH_NAMES)
          .eq('status', 'to_shoot')
          .is('shoot_day_id', null)
          .eq('market', day.market)
          .returns<VideoWithNames[]>()
      : Promise.resolve({ data: [] as VideoWithNames[] }),
  ])

  const items = attached.data ?? []
  const waiting = items.filter((v) => v.status === 'to_shoot')
  const canShoot = me.role === 'videographer' || me.role === 'lead'
  const state = dueState(day.shoot_date, tz)

  return (
    <>
      <PageBand title={formatWeekday(day.shoot_date)} />
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        <div className="space-y-3">
          <Link href="/shoot-days" className="inline-block text-sm font-bold text-blue">
            ‹ Back
          </Link>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <MarketFlag market={day.market} />
            <span className="label-caps text-xs text-grey">{day.studio?.name ?? 'Studio not decided'}</span>
            {day.videographer && <span className="text-sm text-grey">{day.videographer.full_name}</span>}
            {day.closed_at ? (
              <span className="tag tag-blue">Closed</span>
            ) : state === 'overdue' ? (
              <span className="tag tag-salmon">Not closed</span>
            ) : state === 'today' ? (
              <span className="tag tag-yellow">Today</span>
            ) : null}
          </div>
        </div>

        <section className="space-y-3">
          <h2 className="label-caps text-xs text-grey">
            Shot list <span className="text-grey/70">({items.length})</span>
          </h2>
          {items.length === 0 && (
            <div className="card text-center text-grey">
              {me.role === 'lead' ? 'Nothing planned for this day yet. Add videos below.' : 'Nothing planned for this day yet.'}
            </div>
          )}
          {items.map((v, i) => (
            <div key={v.id} className="card space-y-4">
              <div className="flex items-start gap-3">
                <span className="title mt-0.5 w-6 shrink-0 text-xl">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <Link href={`/videos/${v.id}`} className="title text-xl leading-tight">
                    {v.title}
                  </Link>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {v.episode_number && <span className="label-caps text-xs text-grey">Ep {v.episode_number}</span>}
                    {v.status === 'to_shoot' ? (
                      <span className="tag tag-blue">To shoot</span>
                    ) : (
                      <span className="tag tag-cream">Shot</span>
                    )}
                  </div>
                  {v.brief && v.status === 'to_shoot' && (
                    <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-[15px] text-grey">{v.brief}</p>
                  )}
                </div>
              </div>
              {v.status === 'to_shoot' && !day.closed_at && canShoot && <ShotButtons videoId={v.id} />}
              {v.status === 'to_shoot' && !day.closed_at && me.role === 'lead' && (
                <ActionForm action={detachVideo} className="">
                  <input type="hidden" name="video_id" value={v.id} />
                  <SubmitButton className="chip" pendingText="…">
                    Take off this day
                  </SubmitButton>
                </ActionForm>
              )}
            </div>
          ))}

          {(skipped.data ?? []).length > 0 && (
            <div className="card space-y-2">
              <h3 className="label-caps text-xs text-grey">Skipped on this day</h3>
              <ul className="space-y-1.5 text-[15px]">
                {(skipped.data ?? []).map((s) => (
                  <li key={s.id}>
                    {s.video?.title ?? 'A video'} <span className="text-grey">· {s.payload.reason}</span>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-grey">Skipped videos are back on Celine&rsquo;s Unscheduled list.</p>
            </div>
          )}
        </section>

        {!day.closed_at && canShoot && (
          <section className="card space-y-3">
            <h2 className="label-caps text-xs text-grey">Close the day</h2>
            {waiting.length > 0 ? (
              <p className="text-grey">
                Tap Shot or Skipped on every item first. <strong className="text-ink">{waiting.length} left.</strong>
              </p>
            ) : (
              <p className="text-grey">Every shot is done. Close the day to finish.</p>
            )}
            <ActionForm action={closeShootDay}>
              <input type="hidden" name="day_id" value={day.id} />
              <SubmitButton disabled={waiting.length > 0} pendingText="Closing…">
                Close Shoot Day
              </SubmitButton>
            </ActionForm>
          </section>
        )}

        {day.closed_at && (
          <p className="text-sm text-grey">Closed {formatDateTime(day.closed_at, tz)}.</p>
        )}

        <section className="card space-y-3">
          <h2 className="label-caps text-xs text-grey">Footage folder</h2>
          {day.footage_link && (
            <a href={day.footage_link} target="_blank" rel="noreferrer" className="btn-ghost">
              Open the footage in Drive ↗
            </a>
          )}
          {canShoot ? (
            <ActionForm action={saveFootageLink} className="space-y-3">
              <input type="hidden" name="day_id" value={day.id} />
              <PasteLinkField name="footage_link" placeholder="https://drive.google.com/…" />
              <SubmitButton className="btn-ghost" pendingText="Saving…">
                Save footage link
              </SubmitButton>
            </ActionForm>
          ) : (
            !day.footage_link && <p className="text-grey">No footage link yet.</p>
          )}
        </section>

        {me.role === 'lead' && !day.closed_at && (unscheduled.data ?? []).length > 0 && (
          <section className="space-y-3">
            <h2 className="label-caps flex items-center gap-2 text-xs text-grey">
              Add to this day <span className="tag tag-salmon">Unscheduled</span>
            </h2>
            {(unscheduled.data ?? []).map((v) => (
              <div key={v.id} className="card flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold">{v.title}</p>
                  {v.skip_reason && <p className="text-sm text-grey">Skipped: {v.skip_reason}</p>}
                </div>
                <ActionForm action={attachVideo} className="shrink-0">
                  <input type="hidden" name="video_id" value={v.id} />
                  <input type="hidden" name="day_id" value={day.id} />
                  <SubmitButton className="chip" pendingText="…">
                    Add
                  </SubmitButton>
                </ActionForm>
              </div>
            ))}
          </section>
        )}
        {me.role === 'lead' && !day.closed_at && (unscheduled.data ?? []).length === 0 && (
          <p className="text-sm text-grey">
            No unscheduled {MARKET_NAME[day.market]} videos waiting. New videos need a brief before they can be planned.
          </p>
        )}

        {!day.closed_at && <CopyButton text={shootReminder(day, waiting)} label="Copy reminder for this shoot" />}
      </main>
    </>
  )
}
