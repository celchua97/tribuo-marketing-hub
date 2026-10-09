import Link from 'next/link'
import { getMe } from '@/lib/data'
import { getIdeaPerson } from '@/lib/ideas'
import { db } from '@/lib/supabase/admin'
import { getAdminEmail } from '@/lib/admin-auth'
import { loadOverview } from '@/lib/overview'
import { agoLabel, formatDate } from '@/lib/dates'
import { STATUS_LABEL } from '@/lib/labels'
import { AdminButton } from '@/components/admin-button'
import { PageBand, TopBar } from '@/components/top-bar'
import { ROLE_LABEL } from '@/lib/labels'

export const dynamic = 'force-dynamic'

type Tag = { text: string; tone: 'yellow' | 'salmon' | 'cream' | 'blue' }
const TONE = { yellow: 'tag-yellow', salmon: 'tag-salmon', cream: 'tag-cream', blue: 'tag-blue' }

function ToolCard({ href, title, blurb, tags }: { href: string; title: string; blurb: string; tags: Tag[] }) {
  return (
    <Link href={href} className="card block space-y-3 transition active:scale-[0.99]">
      <div className="flex items-start justify-between gap-3">
        <h2 className="title text-2xl leading-tight">{title}</h2>
        <span aria-hidden className="mt-1 text-xl text-grey">
          ›
        </span>
      </div>
      <p className="text-grey">{blurb}</p>
      <div className="flex flex-wrap gap-2">
        {tags.map((t) => (
          <span key={t.text} className={`tag ${TONE[t.tone]}`}>
            {t.text}
          </span>
        ))}
      </div>
    </Link>
  )
}

function Tile({ href, label, value, tone }: { href?: string; label: string; value: number; tone: 'blue' | 'salmon' | 'yellow' | 'cream' }) {
  const bg = { blue: 'bg-white', salmon: 'bg-coral', yellow: 'bg-yellow', cream: 'bg-white' }[tone]
  const body = (
    <div className={`${bg} flex h-full flex-col justify-between gap-2 rounded-[22px] px-5 py-4`}>
      <p className="title text-4xl leading-none">{value}</p>
      <p className="label-caps text-[11px]">{label}</p>
    </div>
  )
  return href ? (
    <Link href={href} className="block transition active:scale-[0.99]">
      {body}
    </Link>
  ) : (
    body
  )
}

function Card({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card space-y-4 ${className}`}>
      <h2 className="label-caps text-xs text-grey">{title}</h2>
      {children}
    </section>
  )
}

export default async function HubHome() {
  const { supabase, me } = await getMe()
  const ideaPerson = await getIdeaPerson()
  const adminEmail = await getAdminEmail()
  const showAdmin = me?.role === 'lead'

  const [overview, mine, newIdeas] = await Promise.all([
    me ? loadOverview(supabase, me) : null,
    ideaPerson
      ? supabase.from('idea_submissions').select('id', { count: 'exact', head: true }).eq('person_id', ideaPerson.id)
      : null,
    adminEmail
      ? db().from('idea_submissions').select('id', { count: 'exact', head: true }).eq('status', 'new')
      : null,
  ])
  const ideaTags: Tag[] = ideaPerson
    ? [{ text: `${mine?.count ?? 0} from you`, tone: 'cream' }]
    : [{ text: 'Add your name to start', tone: 'cream' }]
  const tz = me?.timezone ?? 'UTC'
  const o = overview

  return (
    <div className="min-h-dvh pb-16">
      <TopBar
        label="Hub"
        width="max-w-[980px]"
        menu={{ isAdmin: showAdmin, who: me ? `${me.full_name}, ${ROLE_LABEL[me.role]}` : ideaPerson?.name }}
      >
        {showAdmin && <AdminButton />}
      </TopBar>
      <PageBand
        title="Tribuo Hub"
        intro={me ? `Hi ${me.full_name.split(' ')[0]}. Here is what is going on.` : 'Your marketing tools in one place.'}
        nav={false}
      />
      <main className="mx-auto max-w-[980px] space-y-4 px-4 py-6">
        {!o && (
          <Link href="/who" className="card block space-y-2 text-center">
            <h2 className="title text-2xl">Pick your name to see the overview</h2>
            <p className="text-grey">Tap here, choose your name, and you will land back on this page.</p>
          </Link>
        )}

        {o && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Tile href="/todos" label="Open to-dos" value={o.todo.open} tone="blue" />
              <Tile href="/todos" label="Overdue to-dos" value={o.todo.overdue.length} tone={o.todo.overdue.length ? 'salmon' : 'cream'} />
              <Tile href="/todos" label="Due today" value={o.todo.dueToday} tone={o.todo.dueToday ? 'yellow' : 'cream'} />
              <Tile href="/board" label="Videos awaiting approval" value={o.videos.approvals} tone={o.videos.approvals ? 'yellow' : 'cream'} />
            </div>

            <div className="grid items-start gap-4 md:grid-cols-2">
              <Card title="Needs attention">
                {(() => {
                  const lines: React.ReactNode[] = []
                  for (const t of o.todo.overdue.slice(0, 5))
                    lines.push(
                      <li key={t.id} className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="font-bold">{t.title}</span>
                          <span className="block text-sm text-grey">
                            {t.list}
                            {t.who ? ` · ${t.who}` : ' · nobody assigned'}
                          </span>
                        </span>
                        <span className="tag tag-salmon shrink-0">{formatDate(t.due)}</span>
                      </li>,
                    )
                  if (o.todo.overdue.length > 5)
                    lines.push(
                      <li key="more" className="text-sm text-grey">
                        and {o.todo.overdue.length - 5} more overdue
                      </li>,
                    )
                  if (o.todo.unassigned > 0)
                    lines.push(
                      <li key="un" className="text-sm">
                        <strong>{o.todo.unassigned}</strong> open to-do{o.todo.unassigned === 1 ? ' has' : 's have'} nobody assigned
                      </li>,
                    )
                  if (o.videos.approvals > 0)
                    lines.push(
                      <li key="ap" className="text-sm">
                        <strong>{o.videos.approvals}</strong> video{o.videos.approvals === 1 ? ' is' : 's are'} waiting for approval
                      </li>,
                    )
                  if (o.videos.unscheduled > 0)
                    lines.push(
                      <li key="un2" className="text-sm">
                        <strong>{o.videos.unscheduled}</strong> video{o.videos.unscheduled === 1 ? ' is' : 's are'} not on a Shoot Day
                      </li>,
                    )
                  for (const f of o.videos.followUps)
                    lines.push(
                      <li key={f.person.id} className="text-sm">
                        <strong>{f.person.full_name}</strong>:{' '}
                        {f.overdueVideos.length + f.overdueDays.length > 0
                          ? `${f.overdueVideos.length + f.overdueDays.length} overdue`
                          : f.quietDays === null
                            ? 'no updates yet'
                            : `no update for ${f.quietDays} day${f.quietDays === 1 ? '' : 's'}`}
                      </li>,
                    )
                  return lines.length ? (
                    <ul className="space-y-3">{lines}</ul>
                  ) : (
                    <p className="text-grey">Nothing needs chasing right now.</p>
                  )
                })()}
              </Card>

              <Card title="To-do lists">
                {o.todo.lists.length === 0 ? (
                  <p className="text-grey">No lists yet.</p>
                ) : (
                  <ul className="space-y-4">
                    {o.todo.lists.map((l) => (
                      <li key={l.id} className="space-y-1.5">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="font-bold">{l.name}</span>
                          <span className="text-sm text-grey">
                            {l.open} open · {l.done}/{l.total} done
                          </span>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-sand" role="img" aria-label={`${l.done} of ${l.total} done`}>
                          <div className="h-full rounded-full bg-blue" style={{ width: `${l.total ? Math.round((l.done / l.total) * 100) : 0}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card title="Content pipeline">
                <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {o.videos.stages.map((s) => (
                    <li key={s.status} className="rounded-2xl bg-canvas px-3 py-2.5">
                      <p className="title text-2xl leading-none">{s.count}</p>
                      <p className="mt-1 text-xs text-grey">{STATUS_LABEL[s.status]}</p>
                    </li>
                  ))}
                  <li className="rounded-2xl bg-canvas px-3 py-2.5">
                    <p className="title text-2xl leading-none">{o.videos.posted}</p>
                    <p className="mt-1 text-xs text-grey">Posted</p>
                  </li>
                </ol>
                {o.videos.overdue > 0 && (
                  <p className="text-sm">
                    <strong>{o.videos.overdue}</strong> video{o.videos.overdue === 1 ? ' is' : 's are'} past {o.videos.overdue === 1 ? 'its' : 'their'} due date.
                  </p>
                )}
              </Card>

              <Card title="Who has what">
                {o.todo.people.length === 0 && o.todo.unassigned === 0 ? (
                  <p className="text-grey">No open to-dos.</p>
                ) : (
                  <ul className="space-y-2">
                    {o.todo.people.map((p) => (
                      <li key={p.name} className="flex items-center justify-between gap-3">
                        <span className="font-bold">{p.name}</span>
                        <span className="flex items-center gap-2 text-sm text-grey">
                          {p.overdue > 0 && <span className="tag tag-salmon">{p.overdue} overdue</span>}
                          {p.open} open
                        </span>
                      </li>
                    ))}
                    {o.todo.unassigned > 0 && (
                      <li className="flex items-center justify-between gap-3 text-grey">
                        <span>Nobody assigned</span>
                        <span className="text-sm">{o.todo.unassigned} open</span>
                      </li>
                    )}
                  </ul>
                )}
              </Card>
            </div>

            <Card title="Recent activity">
              {o.activity.length === 0 ? (
                <p className="text-grey">Nothing yet. Ticks and updates show up here.</p>
              ) : (
                <ul className="divide-y divide-beige">
                  {o.activity.map((a, i) => (
                    <li key={i} className="flex items-baseline justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                      <span className="min-w-0">
                        <strong>{a.who}</strong> {a.text} <span className="text-grey">{a.what}</span>
                      </span>
                      <span className="shrink-0 text-sm text-grey">{agoLabel(a.at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <ToolCard
            href="/todos"
            title="To-dos"
            blurb="Lists for Tribuo Marketing, Videography and Content Strategy."
            tags={o ? [{ text: `${o.todo.open} open`, tone: o.todo.open > 0 ? 'yellow' : 'cream' }] : [{ text: 'Pick your name to start', tone: 'cream' }]}
          />
          <ToolCard href="/ideas" title="Idea Bank" blurb="Got an idea, or something we should know? Add it here." tags={ideaTags} />
          {adminEmail ? (
            <ToolCard
              href="/admin"
              title="Admin"
              blurb="Everything the team sends in, who has joined, and who has access."
              tags={[{ text: `${newIdeas?.count ?? 0} new idea${newIdeas?.count === 1 ? '' : 's'}`, tone: 'blue' }]}
            />
          ) : showAdmin ? (
            <ToolCard href="/login" title="Admin" blurb="Sign in with your email to see ideas, people and access." tags={[{ text: 'Sign in', tone: 'cream' }]} />
          ) : null}
        </div>
      </main>
    </div>
  )
}
