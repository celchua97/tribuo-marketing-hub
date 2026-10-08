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
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <MarketFlag market={video.market} />
            {video.episode_number && (
              <span className="label-caps text-xs text-grey">Ep {video.episode_number}</span>
            )}
            {video.pillar && <span className="label-caps text-xs text-grey">{video.pillar.name}</span>}
          </div>
          <p className="title mt-2 text-xl leading-tight">{video.title}</p>
        </div>
        <span aria-hidden className="mt-1 text-xl text-grey">
          ›
        </span>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <StatusPill status={video.status} />
        <DueBadge dueOn={video.due_on} timeZone={timeZone} />
        {showAssignee && video.assignee && (
          <span className="text-xs text-grey">With {video.assignee.full_name}</span>
        )}
      </div>
    </Link>
  )
}
