import Link from 'next/link'
import { getMe } from '@/lib/data'
import { getIdeaPerson } from '@/lib/ideas'
import { db } from '@/lib/supabase/admin'
import { getAdminEmail } from '@/lib/admin-auth'
import { loadOverview } from '@/lib/overview'
import { agoLabel, formatDate } from '@/lib/dates'
import { STATUS_LABEL } from '@/lib/labels'
import { BarChart, Donut, LineChart, PALETTE } from '@/components/dashboard/charts'
import { AdminButton } from '@/components/admin-button'
import { PageBand, TopBar } from '@/components/top-bar'
import { ROLE_LABEL } from '@/lib/labels'

export const dynamic = 'force-dynamic'

function Delta({ text, tone }: { text: string; tone: 'good' | 'bad' | 'flat' }) {
  const cls = { good: 'bg-[#e1ecf7] text-blue', bad: 'bg-coral/40 text-ink', flat: 'bg-sand text-grey' }[tone]
  return <span className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-bold ${cls}`}>{text}</span>
}

function Kpi({ href, label, value, delta }: { href: string; label: string; value: number; delta: React.ReactNode }) {
  return (
    <Link href={href} className="block rounded-[20px] bg-white p-5 transition hover:shadow-[0_2px_14px_rgba(55,80,171,0.10)] active:scale-[0.99]">
      <p className="text-sm text-grey">{label}</p>
      <p className="title mt-1 text-4xl leading-tight">{value}</p>
      <div className="mt-2">{delta}</div>
    </Link>
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
        menu={{ isAdmin: showAdmin, who: me ? `${me.full_name}, ${ROLE_LABEL[me.role]}` : ideaPerson?.name }}
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
                <span className="block text-xs text-grey">{ROLE_LABEL[me.role]}</span>
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
              <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                <Kpi href="/todos" label="Open to-dos" value={o.todo.open} delta={<Delta text={`${o.trend.addedThisWeek} added this week`} tone="flat" />} />
                <Kpi href="/todos" label="Overdue to-dos" value={o.todo.overdue.length} delta={<Delta text={o.todo.overdue.length ? 'Needs a nudge' : 'All on time'} tone={o.todo.overdue.length ? 'bad' : 'good'} />} />
                <Kpi href="/todos" label="Done this week" value={o.trend.doneThisWeek} delta={<Delta text={`${doneDelta >= 0 ? '▲' : '▼'} ${Math.abs(doneDelta)} vs last week`} tone={doneDelta >= 0 ? 'good' : 'bad'} />} />
                <Kpi href="/board" label="Videos to approve" value={o.videos.approvals} delta={<Delta text={o.videos.unscheduled ? `${o.videos.unscheduled} not scheduled` : 'Nothing stuck'} tone={o.videos.unscheduled ? 'bad' : 'flat'} />} />
              </div>

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
                  <BarChart
                    label="Videos at each stage"
                    base="#3750ab"
                    bars={[
                      ...o.videos.stages.map((s) => ({ label: STAGE_SHORT[s.status] ?? STATUS_LABEL[s.status], value: s.count })),
                      { label: 'Posted', value: o.videos.posted },
                    ]}
                  />
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
                  <li><Link href="/todos" className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-canvas">To-dos <span className="text-grey">›</span></Link></li>
                  <li><Link href="/ideas" className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-canvas">Idea Bank <span className="text-grey">{ideaPerson ? `${mine?.count ?? 0} from you` : '›'}</span></Link></li>
                  {adminEmail ? (
                    <li><Link href="/admin" className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-canvas">Admin <span className="text-grey">{newIdeas?.count ?? 0} new idea{newIdeas?.count === 1 ? '' : 's'}</span></Link></li>
                  ) : showAdmin ? (
                    <li><Link href="/login" className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-canvas">Admin sign in <span className="text-grey">›</span></Link></li>
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
