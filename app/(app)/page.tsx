import Link from 'next/link'
import { requireMe, VIDEO_WITH_NAMES } from '@/lib/data'
import type { VideoWithNames } from '@/lib/types'
import { VideoCard } from '@/components/video-card'

export default async function HomePage() {
  const { supabase, me } = await requireMe()
  const { data } = await supabase
    .from('videos')
    .select(VIDEO_WITH_NAMES)
    .neq('status', 'posted')
    .order('due_on', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
    .returns<VideoWithNames[]>()

  const videos = data ?? []
  const mine = videos.filter((v) => v.assignee_id === me.id)
  const others = videos.filter((v) => v.assignee_id !== me.id)

  return (
    <main className="space-y-8">
      {me.role === 'lead' && (
        <Link href="/videos/new" className="btn-dark">
          + New video
        </Link>
      )}

      <section>
        <h1 className="mb-3 text-2xl font-bold">Your list</h1>
        {mine.length === 0 ? (
          <div className="card text-center text-ink/60">Nothing on your plate. Nice.</div>
        ) : (
          <div className="space-y-3">
            {mine.map((v) => (
              <VideoCard key={v.id} video={v} timeZone={me.timezone} />
            ))}
          </div>
        )}
      </section>

      {others.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer list-none text-sm font-semibold text-ink/60">
            <span className="group-open:hidden">Show</span>
            <span className="hidden group-open:inline">Hide</span> what&rsquo;s with the rest of the
            team ({others.length})
          </summary>
          <div className="mt-3 space-y-3">
            {others.map((v) => (
              <VideoCard key={v.id} video={v} timeZone={me.timezone} showAssignee />
            ))}
          </div>
        </details>
      )}
    </main>
  )
}
