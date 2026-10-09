import Link from 'next/link'
import { getMe } from '@/lib/data'
import { getIdeaPerson } from '@/lib/ideas'
import { db } from '@/lib/supabase/admin'
import { getAdminEmail } from '@/lib/admin-auth'
import { loadOverview } from '@/lib/overview'
import { agoLabel, formatDate } from '@/lib/dates'
import { STATUS_LABEL } from '@/lib/labels'
import { ArrowDown, ArrowUp, CheckCircle2, ChevronRight, ClipboardCheck, ListTodo, TriangleAlert } from 'lucide-react'
import { BarChart, Donut, LineChart, PALETTE } from '@/components/dashboard/charts'
import { AdminButton } from '@/components/admin-button'
import { PageBand, TopBar } from '@/components/top-bar'

export const dynamic = 'force-dynamic'

type Stat = { href: string; label: string; value: number; note: React.ReactNode; icon: React.ReactNode; alert?: boolean }

// One strip, four plain figures. No tile per number.
function StatStrip({ stats }: { stats: Stat[] }) {
  return (
    <ul className="grid grid-cols-2 divide-beige rounded-[20px] bg-white lg:grid-cols-4 lg:divide-x [&>li:nth-child(n+3)]:border-t [&>li:nth-child(n+3)]:border-beige lg:[&>li:nth-child(n+3)]:border-t-0">
      {stats.map((s) => (
        <li key={s.label}>
          <Link href={s.href} className="group flex h-full flex-col gap-1 rounded-[20px] px-5 py-4 transition-colors hover:bg-canvas/60">
            <span className="flex items-center gap-2 text-sm text-grey">
              <span className={s.alert ? 'text-[#c2410c]' : 'text-blue'}>{s.icon}</span>
              {s.label}
            </span>
            <span className="tabular text-3xl leading-tight font-extrabold">{s.value}</span>
            <span className="text-xs text-grey">{s.note}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function Panel({ title, action, children, className = '' }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-[20px] bg-white p-5 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

const STAGE_SHORT: Record<string, string> = { to_shoot: 'To\nshoot', to_edit: 'Editing', in_review: 'To\napprove', changes_requested: 'Changes\nasked', approved: 'To\npost' }

const Dot = ({ i }: { i: number }) => <span aria-hidden className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />

const initials = (n: string) => n.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()

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
  const o = overview
  const nowLabel = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: me?.timezone }).format(new Date())

  const donutSlices = o
    ? [...o.todo.people.map((p) => ({ label: p.name, value: p.open })), ...(o.todo.unassigned ? [{ label: 'Nobody assigned', value: o.todo.unassigned }] : [])]
    : []
  const doneDelta = o ? o.trend.doneThisWeek - o.trend.doneLastWeek : 0
  const attention = o ? o.todo.overdue : []

  return (
    <div className="min-h-dvh bg-[#f1ede4] pb-16">
      <TopBar
        label="Hub"
        width="max-w-[1180px]"
      >
        {showAdmin && <AdminButton />}
      </TopBar>
      <main className="mx-auto max-w-[1180px] space-y-5 px-4 pt-2 pb-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="title text-3xl sm:text-4xl">Dashboard</h1>
            <p className="text-sm text-grey">{o ? `${nowLabel}. Here is what is going on.` : 'Your marketing tools in one place.'}</p>
          </div>
          {me && (
            <div className="flex items-center gap-2 rounded-full bg-white py-1.5 pr-4 pl-1.5">
              <span aria-hidden className="flex size-9 items-center justify-center rounded-full bg-coral text-sm font-extrabold">{initials(me.full_name)}</span>
              <span className="leading-tight">
                <span className="block text-sm font-bold">{me.full_name}</span>
              </span>
            </div>
          )}
        </div>

        {!o && (
          <Link href="/who" className="block space-y-2 rounded-[20px] bg-white p-8 text-center">
            <h2 className="title text-2xl">Pick your name to see the overview</h2>
            <p className="text-grey">Tap here, choose your name, and you will land back on this page.</p>
          </Link>
        )}

        {o && (
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-5">
              <StatStrip
                stats={[
                  { href: '/todos', label: 'Open to-dos', value: o.todo.open, icon: <ListTodo className="size-4" aria-hidden />, note: `${o.trend.addedThisWeek} added this week` },
                  { href: '/todos', label: 'Overdue', value: o.todo.overdue.length, icon: <TriangleAlert className="size-4" aria-hidden />, alert: o.todo.overdue.length > 0, note: o.todo.overdue.length ? 'Worth a nudge' : 'All on time' },
                  {
                    href: '/todos',
                    label: 'Done this week',
                    value: o.trend.doneThisWeek,
                    icon: <CheckCircle2 className="size-4" aria-hidden />,
                    note: (
                      <span className="inline-flex items-center gap-1">
                        {doneDelta >= 0 ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />}
                        {Math.abs(doneDelta)} vs last week
                      </span>
                    ),
                  },
                  { href: '/board', label: 'Videos to approve', value: o.videos.approvals, icon: <ClipboardCheck className="size-4" aria-hidden />, note: o.videos.unscheduled ? `${o.videos.unscheduled} not scheduled` : 'Nothing stuck' },
                ]}
              />

              <div className="grid gap-5 md:grid-cols-2">
                <Panel title="To-dos done, last 7 days">
                  <LineChart points={o.trend.points} label="To-dos ticked off each day this week" />
                </Panel>
                <Panel
                  title="To-dos by list"
                  action={
                    <span className="flex items-center gap-3 text-xs text-grey">
                      <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[#c7d0ee]" />Open</span>
                      <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-blue" />Done</span>
                    </span>
                  }
                >
                  <BarChart label="Open and done to-dos in each list" bars={o.todo.lists.map((l) => ({ label: l.name.length > 12 ? l.name.replace(/ /g, '\n') : l.name, value: l.done, extra: l.open }))} />
                </Panel>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <Panel title="Content pipeline">
                  {o.videos.stages.every((s) => s.count === 0) && o.videos.posted === 0 ? (
                    <p className="py-10 text-center text-grey">No videos on the board yet. They appear here once they are added.</p>
                  ) : (
                  <BarChart
                    label="Videos at each stage"
                    base="#3750ab"
                    bars={[
                      ...o.videos.stages.map((s) => ({ label: STAGE_SHORT[s.status] ?? STATUS_LABEL[s.status], value: s.count })),
                      { label: 'Posted', value: o.videos.posted },
                    ]}
                  />
                  )}
                </Panel>
                <Panel title="Open to-dos by person">
                  {donutSlices.length === 0 ? (
                    <p className="text-grey">No open to-dos.</p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-5">
                      <Donut slices={donutSlices} centre={String(o.todo.open)} sub="open" />
                      <ul className="min-w-0 flex-1 space-y-2.5 text-sm">
                        {donutSlices.map((s, i) => (
                          <li key={s.label} className="flex items-center justify-between gap-3">
                            <span className="flex min-w-0 items-center gap-2"><Dot i={i} /><span className="truncate">{s.label}</span></span>
                            <span className="font-bold">{s.value}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Panel>
              </div>

              <Panel title="Needs attention" action={<Link href="/todos" className="rounded-lg bg-[#e1ecf7] px-3 py-1 text-xs font-bold text-blue">See all</Link>}>
                {attention.length === 0 && o.videos.followUps.length === 0 && o.todo.unassigned === 0 && o.videos.approvals === 0 ? (
                  <p className="text-grey">Nothing needs chasing right now.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] text-left text-sm">
                      <thead>
                        <tr className="text-grey">
                          <th className="pb-2 font-normal">To-do</th>
                          <th className="pb-2 font-normal">List</th>
                          <th className="pb-2 font-normal">Who</th>
                          <th className="pb-2 font-normal">Due</th>
                          <th className="pb-2 font-normal">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-beige">
                        {attention.slice(0, 6).map((t) => (
                          <tr key={t.id}>
                            <td className="py-2.5 pr-3 font-bold">{t.title}</td>
                            <td className="py-2.5 pr-3 text-grey">{t.list}</td>
                            <td className="py-2.5 pr-3">{t.who ?? <span className="text-grey">Nobody</span>}</td>
                            <td className="py-2.5 pr-3 text-grey">{formatDate(t.due)}</td>
                            <td className="py-2.5"><span className="tag tag-salmon">Overdue</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <ul className="mt-3 space-y-1.5 text-sm">
                  {attention.length > 6 && <li className="text-grey">and {attention.length - 6} more overdue</li>}
                  {o.todo.unassigned > 0 && <li><strong>{o.todo.unassigned}</strong> open to-do{o.todo.unassigned === 1 ? ' has' : 's have'} nobody assigned</li>}
                  {o.videos.approvals > 0 && <li><strong>{o.videos.approvals}</strong> video{o.videos.approvals === 1 ? ' is' : 's are'} waiting for approval</li>}
                  {o.videos.followUps.map((f) => (
                    <li key={f.person.id}>
                      <strong>{f.person.full_name}</strong>:{' '}
                      {f.overdueVideos.length + f.overdueDays.length > 0
                        ? `${f.overdueVideos.length + f.overdueDays.length} overdue`
                        : f.quietDays === null ? 'no updates yet' : `no update for ${f.quietDays} day${f.quietDays === 1 ? '' : 's'}`}
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>

            <aside className="space-y-5">
              <Panel title="List progress" action={<Link href="/todos" className="text-xs font-bold text-blue">Open</Link>}>
                {o.todo.lists.length === 0 ? (
                  <p className="text-grey">No lists yet.</p>
                ) : (
                  <ul className="space-y-4">
                    {o.todo.lists.map((l) => (
                      <li key={l.id} className="space-y-1.5">
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span>{l.name}</span>
                          <span className="font-bold">{l.total ? Math.round((l.done / l.total) * 100) : 0}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-sand" role="img" aria-label={`${l.done} of ${l.total} done`}>
                          <div className="h-full rounded-full bg-blue" style={{ width: `${l.total ? Math.round((l.done / l.total) * 100) : 0}%` }} />
                        </div>
                        <p className="text-xs text-grey">{l.open} open · {l.done}/{l.total} done</p>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel title="Recent activity">
                {o.activity.length === 0 ? (
                  <p className="text-grey">Nothing yet. Ticks and updates show up here.</p>
                ) : (
                  <ul className="space-y-4">
                    {o.activity.map((a, i) => (
                      <li key={i} className="flex gap-3">
                        <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#e1ecf7] text-xs font-extrabold text-blue">{initials(a.who)}</span>
                        <span className="min-w-0 text-sm">
                          <span className="block"><strong>{a.who}</strong> {a.text} <span className="text-grey">{a.what}</span></span>
                          <span className="text-xs text-grey">{agoLabel(a.at)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel title="Jump to">
                <ul className="space-y-1 text-sm font-bold">
                  <li><Link href="/todos" className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-canvas">To-dos <ChevronRight className="size-4 text-grey" aria-hidden /></Link></li>
                  <li><Link href="/ideas" className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-canvas">Idea Bank <span className="text-grey">{ideaPerson ? `${mine?.count ?? 0} from you` : <ChevronRight className="size-4" aria-hidden />}</span></Link></li>
                  {adminEmail ? (
                    <li><Link href="/admin" className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-canvas">Admin <span className="text-grey">{newIdeas?.count ?? 0} new idea{newIdeas?.count === 1 ? '' : 's'}</span></Link></li>
                  ) : showAdmin ? (
                    <li><Link href="/login" className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-canvas">Admin sign in <ChevronRight className="size-4 text-grey" aria-hidden /></Link></li>
                  ) : null}
                </ul>
              </Panel>
            </aside>
          </div>
        )}
      </main>
    </div>
  )
}
