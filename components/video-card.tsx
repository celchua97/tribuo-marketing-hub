import Link from 'next/link'
import type { VideoWithNames } from '@/lib/types'
import { DueBadge, MarketFlag, StatusPill } from './badges'

export function VideoCard({
  video,
  timeZone,
  showAssignee = false,
}: {
  video: VideoWithNames
  timeZone: string
  showAssignee?: boolean
}) {
  return (
    <Link href={`/videos/${video.id}`} className="card block transition active:scale-[0.99]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <MarketFlag market={video.market} />
            {video.episode_number && (
              <span className="text-xs font-semibold text-ink/50">Ep {video.episode_number}</span>
            )}
            {video.pillar && <span className="truncate text-xs text-ink/50">{video.pillar.name}</span>}
          </div>
          <p className="mt-1 text-lg leading-snug font-semibold">{video.title}</p>
        </div>
        <span aria-hidden className="mt-1 text-xl text-ink/30">
          ›
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusPill status={video.status} />
        <DueBadge dueOn={video.due_on} timeZone={timeZone} />
        {showAssignee && video.assignee && (
          <span className="text-xs text-ink/50">With {video.assignee.full_name}</span>
        )}
      </div>
    </Link>
  )
}
