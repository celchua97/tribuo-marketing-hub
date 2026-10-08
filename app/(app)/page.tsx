import Link from 'next/link'
import { requireMe } from '@/lib/data'
import { loadBoard, plateFor } from '@/lib/board'
import { buildNudge, shootReminder } from '@/lib/nudge'
import { VideoCard } from '@/components/video-card'
import { PageBand } from '@/components/top-bar'
import { CopyButton } from '@/components/copy-button'
import { DueGroups, Section } from '@/components/due-groups'
import { ShootDayCard } from '@/components/shoot-day-card'
import { FollowUpSection } from '@/components/follow-up'

export default async function HomePage() {
  const { supabase, me } = await requireMe()
  const board = await loadBoard(supabase)
  const plate = plateFor(me, board)
  const tz = me.timezone
  const nudge = buildNudge(me, plate, board.openComments, tz)
  // A ready-to-paste nudge for each person the Head of Marketing may need to chase
  const nudges: Record<string, string> = {}
  if (plate.role === 'lead') {
    for (const f of plate.followUps) {
      nudges[f.person.id] = buildNudge(f.person, plateFor(f.person, board), board.openComments, f.person.timezone)
    }
  }
  const card = (v: (typeof board.videos)[number], extra: { age?: boolean } = {}) => (
    <VideoCard
      key={v.id}
      video={v}
      timeZone={tz}
      openComments={board.openComments[v.id]?.open ?? 0}
      flagged={board.openComments[v.id]?.flagged ?? false}
      {...extra}
    />
  )

  return (
    <>
      <PageBand title="Your list" />
      <main className="mx-auto max-w-2xl space-y-8 px-4 py-6">
        {plate.role === 'lead' && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Link href="/videos/new" className="btn-primary">
                + New video
              </Link>
              <Link href="/shoot-days" className="btn-ghost">
                + Plan a Shoot Day
              </Link>
            </div>

            <Section title="Waiting for your approval" count={plate.approvals.length}>
              {plate.approvals.map((v) => card(v))}
            </Section>
            <FollowUpSection
              followUps={plate.followUps}
              people={board.people}
              lastActive={board.lastActive}
              nudges={nudges}
              timeZone={tz}
            />
            <Section title="Questions from the editor" count={plate.questions.length}>
              {plate.questions.map((v) => card(v))}
            </Section>
            <Section
              title="Unscheduled"
              count={plate.unscheduled.length}
              tag={<span className="tag tag-salmon">Needs a Shoot Day</span>}
            >
              {plate.unscheduled.map((v) => card(v))}
            </Section>
            <Section title="Ready to post" count={plate.readyToPost.length}>
              {plate.readyToPost.map((v) => card(v))}
            </Section>

            {plate.approvals.length +
              plate.questions.length +
              plate.unscheduled.length +
              plate.readyToPost.length ===
              0 && <div className="card text-center text-grey">Nothing else is waiting on you.</div>}
          </>
        )}

        {plate.role === 'videographer' && (
          <>
            {plate.days.length === 0 ? (
              <div className="card text-center text-grey">No Shoot Days planned yet.</div>
            ) : (
              <DueGroups
                items={plate.days}
                due={(d) => d.shoot_date}
                timeZone={tz}
                render={(d) => <ShootDayCard key={d.id} day={d} shots={plate.shots[d.id] ?? []} timeZone={tz} />}
              />
            )}
            {plate.days[0] && (
              <CopyButton
                text={shootReminder(plate.days[0], plate.shots[plate.days[0].id] ?? [])}
                label="Copy reminder for the next shoot"
              />
            )}
          </>
        )}

        {plate.role === 'editor' &&
          (plate.tasks.length === 0 ? (
            <div className="card text-center text-grey">Nothing to edit. Nice.</div>
          ) : (
            <DueGroups items={plate.tasks} due={(v) => v.due_on} timeZone={tz} render={(v) => card(v)} />
          ))}

        <CopyButton text={nudge} label="Copy today's nudge" />
      </main>
    </>
  )
}
