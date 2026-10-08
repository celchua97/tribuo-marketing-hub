import Link from 'next/link'
import { agoLabel } from '@/lib/dates'
import type { VideoWithNames } from '@/lib/types'
import { AgeBadge, DueBadge, MarketFlag, StatusPill } from './badges'

export function VideoCard({
  video,
  timeZone,
  showAssignee = false,
  openComments = 0,
  flagged = false,
}: {
  video: VideoWithNames
  timeZone: string
  showAssignee?: boolean
  openComments?: number
  flagged?: boolean
}) {
  const unscheduled = video.status === 'to_shoot' && !video.shoot_day_id
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
        {unscheduled ? (
          <span className="tag tag-salmon">Not on a Shoot Day</span>
        ) : (
          <StatusPill status={video.status} />
        )}
        {video.status === 'in_review' && <AgeBadge since={video.status_changed_at} />}
        {unscheduled && video.skip_reason && <span className="tag tag-cream">Skipped: {video.skip_reason}</span>}
        {openComments > 0 && (
          <span className="tag tag-salmon">
            {openComments} comment{openComments === 1 ? '' : 's'} to fix
          </span>
        )}
        {flagged && <span className="tag tag-yellow">Editor has a question</span>}
        <DueBadge dueOn={video.due_on} timeZone={timeZone} />
        {showAssignee && video.assignee && (
          <span className="text-xs text-grey">
            With {video.assignee.full_name} · updated {agoLabel(video.status_changed_at)}
          </span>
        )}
      </div>
    </Link>
  )
}
