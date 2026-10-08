import Link from 'next/link'
import { requireMe, VIDEO_WITH_NAMES } from '@/lib/data'
import { loadBoard } from '@/lib/board'
import { MARKET_FLAG, MARKET_NAME } from '@/lib/labels'
import type { Market, Profile, VideoWithNames } from '@/lib/types'
import { PageBand } from '@/components/top-bar'
import { VideoCard } from '@/components/video-card'

type Filters = { market?: string; person?: string }

function href(f: Filters) {
  const q = new URLSearchParams()
  if (f.market) q.set('market', f.market)
  if (f.person) q.set('person', f.person)
  const s = q.toString()
  return s ? `/videos?${s}` : '/videos'
}

export default async function AllVideosPage({ searchParams }: { searchParams: Promise<Filters> }) {
  const sp = await searchParams
  const { supabase, me } = await requireMe()
  const market = sp.market === 'MY' || sp.market === 'KH' ? (sp.market as Market) : undefined
  const person = sp.person || undefined

  const [{ data: all }, board, { data: people }] = await Promise.all([
    supabase
      .from('videos')
      .select(VIDEO_WITH_NAMES)
      .order('status_changed_at', { ascending: false })
      .returns<VideoWithNames[]>(),
    loadBoard(supabase),
    supabase.from('profiles').select('id, full_name').eq('active', true).order('created_at').returns<Pick<Profile, 'id' | 'full_name'>[]>(),
  ])

  const videos = (all ?? []).filter((v) => (!market || v.market === market) && (!person || v.assignee_id === person))

  const chip = (label: string, to: string, on: boolean) => (
    <Link key={label} href={to} className={`chip ${on ? 'chip-on' : ''}`} aria-current={on ? 'true' : undefined}>
      {label}
    </Link>
  )

  return (
    <>
      <PageBand title="All videos" />
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        <div className="space-y-4">
          <div>
            <p className="label mb-2">Market</p>
            <div className="flex flex-wrap gap-2">
              {chip('All', href({ person }), !market)}
              {(['MY', 'KH'] as Market[]).map((m) =>
                chip(`${MARKET_FLAG[m]} ${MARKET_NAME[m]}`, href({ market: m, person }), market === m),
              )}
            </div>
          </div>
          <div>
            <p className="label mb-2">With</p>
            <div className="flex flex-wrap gap-2">
              {chip('Everyone', href({ market }), !person)}
              {(people ?? []).map((p) => chip(p.full_name, href({ market, person: p.id }), person === p.id))}
            </div>
          </div>
        </div>

        <p className="text-sm text-grey">
          {videos.length} video{videos.length === 1 ? '' : 's'}
        </p>

        {videos.length === 0 ? (
          <div className="card text-center text-grey">No videos match.</div>
        ) : (
          <div className="space-y-3">
            {videos.map((v) => (
              <VideoCard
                key={v.id}
                video={v}
                timeZone={me.timezone}
                showAssignee
                openComments={board.openComments[v.id]?.open ?? 0}
                flagged={board.openComments[v.id]?.flagged ?? false}
              />
            ))}
          </div>
        )}
      </main>
    </>
  )
}
