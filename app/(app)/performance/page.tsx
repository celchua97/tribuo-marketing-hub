import Link from 'next/link'
import { ArrowDown, ArrowUp, Eye, MousePointerClick, Users, Wallet, Target } from 'lucide-react'
import { requireLead } from '@/lib/data'
import { addDays } from '@/lib/dates'
import { loadMeta, RANGES, type Totals } from '@/lib/meta'
import { BarChart, LineChart } from '@/components/dashboard/charts'
import { PageBand } from '@/components/top-bar'
import { ActionForm, SubmitButton } from '@/components/action-form'
import { refreshMeta } from './actions'

export const dynamic = 'force-dynamic'

const money = (n: number, cur: string) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: cur, maximumFractionDigits: n >= 100 ? 0 : 2 }).format(n)
const int = (n: number) => new Intl.NumberFormat('en-GB').format(Math.round(n))

// Campaign names are long: drop the shared prefix and split onto two short lines for the chart
function twoLines(name: string) {
  const s = name.replace(/^Tribuo MY\s*-\s*/i, '').trim()
  if (s.length <= 11) return s
  const mid = s.length / 2
  const cut = [...s.matchAll(/ /g)].map((m) => m.index as number).sort((x, y) => Math.abs(x - mid) - Math.abs(y - mid))[0]
  const lines = cut === undefined ? [s.slice(0, 11) + '…'] : [s.slice(0, cut), s.slice(cut + 1)]
  return lines.map((l) => (l.length > 12 ? l.slice(0, 11) + '…' : l)).join('\n')
}

function change(now: number, before: number, lowerIsBetter = false) {
  if (before === 0) return null
  const pct = ((now - before) / before) * 100
  return { pct, good: lowerIsBetter ? pct <= 0 : pct >= 0 }
}

function Stat({ icon, label, value, delta }: { icon: React.ReactNode; label: string; value: string; delta: ReturnType<typeof change> }) {
  return (
    <li className="flex flex-col gap-1 px-5 py-4">
      <span className="flex items-center gap-2 text-sm text-grey">
        <span className="text-blue">{icon}</span>
        {label}
      </span>
      <span className="tabular text-3xl leading-tight font-extrabold">{value}</span>
      <span className="text-xs text-grey">
        {delta ? (
          <span className={`inline-flex items-center gap-1 font-bold ${delta.good ? 'text-blue' : 'text-[#c2410c]'}`}>
            {delta.pct >= 0 ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />}
            {Math.abs(delta.pct).toFixed(0)}%<span className="font-normal text-grey"> vs the period before</span>
          </span>
        ) : (
          'No earlier period to compare'
        )}
      </span>
    </li>
  )
}

export default async function PerformancePage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { me } = await requireLead('/performance')
  const { range = '30' } = await searchParams
  const report = await loadMeta(range, me.timezone)
  const active = RANGES.find((r) => r.key === range)?.key ?? '30'

  return (
    <>
      <PageBand title="Performance" nav={false} intro="Leads and spend from Meta ads, straight from the ad account." />
      <main className="mx-auto max-w-[1180px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        {!report.ok && report.error === 'not_configured' && <Setup />}
        {!report.ok && report.error !== 'not_configured' && (
          <section className="rounded-[20px] bg-white p-6 space-y-3">
            <h2 className="text-base font-bold">Meta did not answer</h2>
            <p role="alert" className="text-danger">{report.error}</p>
            <p className="text-grey">
              This usually means the access token has expired, or it does not have access to the ad account. Check the steps in the README under
              &ldquo;Meta ads dashboard&rdquo;.
            </p>
          </section>
        )}
        {report.ok && <Report report={report} active={active} />}
      </main>
    </>
  )
}

function Report({ report, active }: { report: Extract<Awaited<ReturnType<typeof loadMeta>>, { ok: true }>; active: string }) {
  const { totals: t, previous: p, currency: cur } = report
  const updated = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(report.fetchedAt))
  const leadCampaigns = report.campaigns.filter((c) => c.leads > 0).sort((a, b) => b.leads - a.leads)
  const stats = [
    { icon: <Users className="size-4" aria-hidden />, label: 'Leads', value: int(t.leads), delta: change(t.leads, p.leads) },
    { icon: <Target className="size-4" aria-hidden />, label: 'Cost per lead', value: t.cpl === null ? 'No leads' : money(t.cpl, cur), delta: t.cpl !== null && p.cpl !== null ? change(t.cpl, p.cpl, true) : null },
    { icon: <Wallet className="size-4" aria-hidden />, label: 'Spend', value: money(t.spend, cur), delta: change(t.spend, p.spend) },
    { icon: <MousePointerClick className="size-4" aria-hidden />, label: 'Link click rate', value: `${t.ctr.toFixed(2)}%`, delta: change(t.ctr, p.ctr) },
  ]
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-bold">{report.accountName}</p>
          <p className="text-sm text-grey">
            {report.since} to {report.until}. Updated {updated}, refreshes every 5 minutes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <nav aria-label="Date range" className="inline-flex overflow-hidden rounded-full border-2 border-beige bg-white">
            {RANGES.map((r) => (
              <Link
                key={r.key}
                href={`/performance?range=${r.key}`}
                aria-current={active === r.key ? 'page' : undefined}
                className={`px-3.5 py-2 text-sm font-bold ${active === r.key ? 'bg-blue text-white' : 'text-grey hover:bg-canvas'}`}
              >
                {r.label}
              </Link>
            ))}
          </nav>
          <ActionForm action={async () => { 'use server'; await refreshMeta(); return undefined }} className="">
            <SubmitButton className="chip" pendingText="Refreshing…">
              Refresh now
            </SubmitButton>
          </ActionForm>
        </div>
      </div>

      <ul className="grid grid-cols-2 divide-beige rounded-[20px] bg-white lg:grid-cols-4 lg:divide-x [&>li:nth-child(n+3)]:border-t [&>li:nth-child(n+3)]:border-beige lg:[&>li:nth-child(n+3)]:border-t-0">
        {stats.map((s) => (
          <Stat key={s.label} {...s} />
        ))}
      </ul>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="rounded-[20px] bg-white p-5">
          <h2 className="mb-4 text-base font-bold">Leads per day</h2>
          <LineChart label="Leads each day" points={report.days.map((d) => ({ label: d.date.slice(5).replace('-', '/'), value: d.leads }))} />
        </section>
        <section className="rounded-[20px] bg-white p-5">
          <h2 className="mb-4 text-base font-bold">Leads by campaign</h2>
          {leadCampaigns.length === 0 ? (
            <p className="py-10 text-center text-grey">No leads in this period.</p>
          ) : (
            <BarChart label="Leads for each campaign" bars={leadCampaigns.slice(0, 6).map((c) => ({ label: twoLines(c.name), value: c.leads }))} />
          )}
        </section>
      </div>

      <section className="rounded-[20px] bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <Eye className="size-4 text-blue" aria-hidden />
          <h2 className="text-base font-bold">Campaigns</h2>
          <span className="text-sm text-grey">
            {int(t.impressions)} impressions, {int(t.clicks)} link clicks
          </span>
        </div>
        {report.campaigns.length === 0 ? (
          <p className="text-grey">No campaign had spend in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="text-grey">
                  <th className="pb-2 font-normal">Campaign</th>
                  <th className="pb-2 text-right font-normal">Spend</th>
                  <th className="pb-2 text-right font-normal">Leads</th>
                  <th className="pb-2 text-right font-normal">Cost per lead</th>
                  <th className="pb-2 text-right font-normal">Click rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-beige">
                {report.campaigns.map((c: Totals & { id: string; name: string }) => (
                  <tr key={c.id}>
                    <td className="py-2.5 pr-3 font-bold">{c.name}</td>
                    <td className="py-2.5 text-right">{money(c.spend, cur)}</td>
                    <td className="py-2.5 text-right">{c.leads ? int(c.leads) : <span className="text-grey">None</span>}</td>
                    <td className="py-2.5 text-right">{c.cpl === null ? <span className="text-grey">None</span> : money(c.cpl, cur)}</td>
                    <td className="py-2.5 text-right">{c.ctr.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

function Setup() {
  return (
    <section className="space-y-4 rounded-[20px] bg-white p-6">
      <h2 className="text-lg font-bold">Connect Meta ads</h2>
      <p className="text-grey">This page shows live numbers once the site has a key to read your ad account. It only needs permission to read, never to change ads.</p>
      <ol className="list-decimal space-y-2 pl-5">
        <li>In Meta Business Settings, open <strong>Users → System users</strong> and add a system user.</li>
        <li>Give it access to the <strong>Tribuo x Malaysia</strong> ad account with <strong>View performance</strong>.</li>
        <li>Choose <strong>Generate token</strong>, pick any app, tick only <strong>ads_read</strong>, and copy the token.</li>
        <li>In Vercel, add <code>META_ACCESS_TOKEN</code> with that token, and redeploy.</li>
      </ol>
      <p className="text-sm text-grey">The ad account is set to Tribuo x Malaysia (704483032098939). To use another one, add <code>META_AD_ACCOUNT_ID</code> in Vercel.</p>
    </section>
  )
}
