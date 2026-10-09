import { addDays, todayIn } from './dates'

// Live numbers from the Meta Marketing API. Server only: the access token never reaches the browser.
const VERSION = process.env.META_GRAPH_VERSION ?? 'v23.0'
const BASE = process.env.META_GRAPH_BASE ?? 'https://graph.facebook.com'
// The Tribuo Malaysia ad account. Change it with META_AD_ACCOUNT_ID in Vercel.
const ACCOUNT = (process.env.META_AD_ACCOUNT_ID ?? '704483032098939').replace(/^act_/, '')

// Which Meta results count as a lead: forms, pixel leads and WhatsApp or Messenger conversations.
const LEAD_ACTIONS = (
  process.env.META_LEAD_ACTIONS ??
  'lead,onsite_conversion.lead_grouped,offsite_conversion.fb_pixel_lead,onsite_conversion.messaging_conversation_started_7d'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

export const metaConfigured = () => !!process.env.META_ACCESS_TOKEN

type Action = { action_type: string; value: string }
type Row = {
  spend?: string
  impressions?: string
  reach?: string
  clicks?: string
  inline_link_clicks?: string
  actions?: Action[]
  date_start?: string
  campaign_id?: string
  campaign_name?: string
}

export type Totals = { spend: number; impressions: number; clicks: number; leads: number; cpl: number | null; ctr: number }
export type Day = { date: string } & Totals
export type Campaign = { id: string; name: string } & Totals

const num = (v: string | undefined) => Number(v ?? 0) || 0

const FORM = ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead']
const CHAT = 'onsite_conversion.messaging_conversation_started_7d'

// Meta can report one form lead under several names, so those count once (the biggest).
// WhatsApp and Messenger chats are added on top. Anything else listed in META_LEAD_ACTIONS is added too.
function leadsOf(actions: Action[] | undefined) {
  const by = Object.fromEntries((actions ?? []).map((a) => [a.action_type, num(a.value)]))
  const form = Math.max(0, ...FORM.filter((t) => LEAD_ACTIONS.includes(t)).map((t) => by[t] ?? 0))
  const chat = LEAD_ACTIONS.includes(CHAT) ? (by[CHAT] ?? 0) : 0
  const other = LEAD_ACTIONS.filter((t) => t !== CHAT && !FORM.includes(t)).reduce((n, t) => n + (by[t] ?? 0), 0)
  return form + chat + other
}

function totalsOf(r: Row): Totals {
  const spend = num(r.spend)
  const leads = leadsOf(r.actions)
  const impressions = num(r.impressions)
  const clicks = num(r.inline_link_clicks) || num(r.clicks)
  return { spend, impressions, clicks, leads, cpl: leads > 0 ? spend / leads : null, ctr: impressions > 0 ? (clicks / impressions) * 100 : 0 }
}

function sum(rows: Totals[]): Totals {
  const spend = rows.reduce((n, r) => n + r.spend, 0)
  const impressions = rows.reduce((n, r) => n + r.impressions, 0)
  const clicks = rows.reduce((n, r) => n + r.clicks, 0)
  const leads = rows.reduce((n, r) => n + r.leads, 0)
  return { spend, impressions, clicks, leads, cpl: leads > 0 ? spend / leads : null, ctr: impressions > 0 ? (clicks / impressions) * 100 : 0 }
}

async function graph(path: string, params: Record<string, string>): Promise<{ data?: Row[]; error?: string; raw?: Record<string, unknown> }> {
  const token = process.env.META_ACCESS_TOKEN
  if (!token) return { error: 'no token' }
  const q = new URLSearchParams({ ...params, access_token: token })
  let url: string | null = `${BASE}/${VERSION}/${path}?${q}`
  const out: Row[] = []
  let raw: Record<string, unknown> | undefined
  for (let page = 0; url && page < 6; page++) {
    // Refreshed every 5 minutes. The Refresh button clears this cache straight away.
    const res: Response = await fetch(url, { next: { revalidate: 300, tags: ['meta'] } })
    const body = (await res.json().catch(() => ({}))) as { data?: Row[]; error?: { message?: string }; paging?: { next?: string } } & Record<string, unknown>
    if (!res.ok || body.error) return { error: body.error?.message ?? `Meta answered with ${res.status}` }
    raw = body
    if (body.data) out.push(...body.data)
    url = body.paging?.next ?? null
  }
  return { data: out, raw }
}

export type MetaReport = {
  ok: true
  accountName: string
  currency: string
  since: string
  until: string
  totals: Totals
  previous: Totals
  days: Day[]
  campaigns: Campaign[]
  fetchedAt: string
} | { ok: false; error: string }

export const RANGES = [
  { key: '7', label: '7 days', days: 7 },
  { key: '14', label: '14 days', days: 14 },
  { key: '30', label: '30 days', days: 30 },
  { key: '90', label: '90 days', days: 90 },
] as const

export async function loadMeta(rangeKey: string, timeZone: string): Promise<MetaReport> {
  if (!metaConfigured()) return { ok: false, error: 'not_configured' }
  const range = RANGES.find((r) => r.key === rangeKey) ?? RANGES[2]
  const until = todayIn(timeZone)
  const since = addDays(until, -(range.days - 1))
  const prevUntil = addDays(since, -1)
  const prevSince = addDays(prevUntil, -(range.days - 1))
  const fields = 'spend,impressions,reach,clicks,inline_link_clicks,actions'
  const act = `act_${ACCOUNT}`

  const [info, daily, camps, prev] = await Promise.all([
    fetchInfo(act),
    graph(`${act}/insights`, { fields, level: 'account', time_increment: '1', time_range: JSON.stringify({ since, until }), limit: '200' }),
    graph(`${act}/insights`, { fields: `${fields},campaign_id,campaign_name`, level: 'campaign', time_range: JSON.stringify({ since, until }), limit: '200' }),
    graph(`${act}/insights`, { fields, level: 'account', time_range: JSON.stringify({ since: prevSince, until: prevUntil }), limit: '10' }),
  ])
  const err = info.error ?? daily.error ?? camps.error ?? prev.error
  if (err) return { ok: false, error: err }

  const byDate = new Map((daily.data ?? []).map((r) => [r.date_start as string, totalsOf(r)]))
  const days: Day[] = Array.from({ length: range.days }, (_, i) => {
    const date = addDays(since, i)
    return { date, ...(byDate.get(date) ?? sum([])) }
  })
  const campaigns: Campaign[] = (camps.data ?? [])
    .map((r) => ({ id: r.campaign_id as string, name: r.campaign_name as string, ...totalsOf(r) }))
    .filter((c) => c.spend > 0 || c.leads > 0 || c.impressions > 0)
    .sort((a, b) => b.spend - a.spend)

  return {
    ok: true,
    accountName: info.name,
    currency: info.currency,
    since,
    until,
    totals: sum(days),
    previous: sum((prev.data ?? []).map(totalsOf)),
    days,
    campaigns,
    fetchedAt: new Date().toISOString(),
  }
}

async function fetchInfo(act: string): Promise<{ name: string; currency: string; error?: string }> {
  const token = process.env.META_ACCESS_TOKEN as string
  const url = `${BASE}/${VERSION}/${act}?${new URLSearchParams({ fields: 'name,currency', access_token: token })}`
  const res = await fetch(url, { next: { revalidate: 3600, tags: ['meta'] } })
  const body = (await res.json().catch(() => ({}))) as { name?: string; currency?: string; error?: { message?: string } }
  if (!res.ok || body.error) return { name: '', currency: 'MYR', error: body.error?.message ?? `Meta answered with ${res.status}` }
  return { name: body.name ?? 'Meta ads', currency: body.currency ?? 'MYR' }
}
