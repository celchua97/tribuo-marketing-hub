import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireMe, VIDEO_WITH_NAMES } from '@/lib/data'
import { eventText } from '@/lib/labels'
import { formatDateTime } from '@/lib/dates'
import type { FeedbackComment, Profile, Submission, VideoEvent, VideoWithNames } from '@/lib/types'
import { AgeBadge, DueBadge, MarketFlag, StatusPill } from '@/components/badges'
import { CommentChecklist } from '@/components/comment-checklist'
import { ActionForm, SubmitButton } from '@/components/action-form'
import { PasteLinkField } from '@/components/paste-link-field'
import { ReviewPanel } from '@/components/review-panel'
import { PageBand } from '@/components/top-bar'
import { markPosted, markShot, submitForReview } from '../../actions'

export default async function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, me } = await requireMe()

  const [{ data: video }, { data: comments }, { data: submissions }, { data: events }] =
    await Promise.all([
      supabase.from('videos').select(VIDEO_WITH_NAMES).eq('id', id).maybeSingle<VideoWithNames>(),
      supabase
        .from('feedback_comments')
        .select('*')
        .eq('video_id', id)
        .order('created_at')
        .order('position')
        .returns<FeedbackComment[]>(),
      supabase
        .from('submissions')
        .select('*, submitter:profiles!submissions_submitted_by_fkey(full_name)')
        .eq('video_id', id)
        .order('round', { ascending: false })
        .returns<Submission[]>(),
      supabase
        .from('video_events')
        .select('*, actor:profiles!video_events_actor_id_fkey(full_name)')
        .eq('video_id', id)
        .order('created_at', { ascending: false })
        .returns<VideoEvent[]>(),
    ])
  if (!video) notFound()

  const tz = me.timezone
  const allComments = comments ?? []
  const openComments = allComments.filter((c) => !c.resolved_at)
  // The latest round of feedback is the checklist; older rounds are tucked away.
  const latestRound = allComments[allComments.length - 1]?.submission_id ?? null
  const current = allComments.filter((c) => c.submission_id === latestRound)
  const earlier = allComments.filter((c) => c.submission_id !== latestRound)
  const canTick = (me.role === 'editor' || me.role === 'lead') && video.status === 'changes_requested'

  return (
    <>
      <PageBand title={video.title} />
      <main className="mx-auto max-w-2xl space-y-5 px-4 py-6">
      <div className="space-y-4">
        <Link href="/board" className="inline-block text-sm font-bold text-blue">
          ‹ Back
        </Link>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <MarketFlag market={video.market} />
          {video.episode_number && (
            <span className="label-caps text-xs text-grey">Ep {video.episode_number}</span>
          )}
          {video.pillar && <span className="label-caps text-xs text-grey">{video.pillar.name}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={video.status} />
          {video.status === 'in_review' && <AgeBadge since={video.status_changed_at} />}
          {openComments.length > 0 && (
            <span className="tag tag-salmon">
              {openComments.length} comment{openComments.length === 1 ? '' : 's'} to fix
            </span>
          )}
          <DueBadge dueOn={video.due_on} timeZone={tz} />
          {video.assignee && (
            <span className="text-sm text-grey">
              {video.assignee_id === me.id ? 'With you' : `With ${video.assignee.full_name}`}
            </span>
          )}
        </div>
      </div>

      <ActionPanel video={video} me={me} openCount={openComments.length} />

      {current.length > 0 && (
        <section className="card space-y-3">
          <h2 className="label-caps text-xs text-grey">
            Changes to make{' '}
            <span className="text-grey/70">
              ({current.filter((c) => !c.resolved_at).length} of {current.length} left)
            </span>
          </h2>
          <CommentChecklist comments={current} canTick={canTick} />
        </section>
      )}

      {earlier.length > 0 && (
        <details className="card">
          <summary className="label-caps cursor-pointer text-xs text-grey">
            Earlier feedback ({earlier.length})
          </summary>
          <div className="mt-3">
            <CommentChecklist comments={earlier} canTick={false} />
          </div>
        </details>
      )}

      {video.latest_drive_link && (
        <a href={video.latest_drive_link} target="_blank" rel="noreferrer" className="btn-ghost">
          Open latest edit in Drive ↗
        </a>
      )}
      {video.posted_link && (
        <a href={video.posted_link} target="_blank" rel="noreferrer" className="btn-ghost">
          View the live post ↗
        </a>
      )}

      <section className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="label-caps text-xs text-grey">Direction</h2>
          {me.role === 'lead' && (
            <Link href={`/videos/${id}/edit`} className="text-sm font-bold text-blue">
              Edit
            </Link>
          )}
        </div>
        {video.reference_link ? (
          <a href={video.reference_link} target="_blank" rel="noreferrer" className="btn-primary">
            Open the Google Slides ↗
          </a>
        ) : (
          <p className="text-grey">No Google Slides link added.</p>
        )}
      </section>

      {(submissions ?? []).length > 1 && (
        <section className="card">
          <h2 className="label-caps mb-3 text-xs text-grey">Earlier versions</h2>
          <ul className="space-y-2 text-sm">
            {(submissions ?? []).slice(1).map((s) => (
              <li key={s.id}>
                <a href={s.drive_link} target="_blank" rel="noreferrer" className="text-blue">
                  Version {s.round}
                </a>{' '}
                <span className="text-grey">· {formatDateTime(s.submitted_at, tz)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2 className="label-caps mb-3 text-xs text-grey">History</h2>
        <ol className="space-y-2 text-sm">
          {(events ?? []).map((e) => (
            <li key={e.id} className="flex justify-between gap-3">
              <span>
                <strong className="font-bold">{e.actor?.full_name ?? 'Someone'}</strong>{' '}
                {eventText(e.kind, e.to_status, e.payload)}
              </span>
              <span className="shrink-0 text-grey">{formatDateTime(e.created_at, tz)}</span>
            </li>
          ))}
        </ol>
      </section>
      </main>
    </>
  )
}

function ActionPanel({ video, me, openCount }: { video: VideoWithNames; me: Profile; openCount: number }) {
  const isLead = me.role === 'lead'
  const hidden = <input type="hidden" name="video_id" value={video.id} />

  switch (video.status) {
    case 'to_shoot':
      if (me.role !== 'videographer' && !isLead) return null
      return (
        <div className="space-y-3">
          {!video.shoot_day_id && (
            <div className="card space-y-3">
              <p className="flex flex-wrap items-center gap-2">
                <span className="tag tag-salmon">Not on a Shoot Day</span>
                {video.skip_reason && <span className="tag tag-cream">Skipped: {video.skip_reason}</span>}
              </p>
              {isLead && (
                <Link href="/shoot-days" className="btn-ghost">
                  Plan a Shoot Day
                </Link>
              )}
            </div>
          )}
          {video.shoot_day_id && (
            <Link href={`/shoot-days/${video.shoot_day_id}`} className="btn-ghost">
              Open the Shoot Day
            </Link>
          )}
          <ActionForm action={markShot}>
            {hidden}
            <SubmitButton pendingText="Saving…">Shot</SubmitButton>
          </ActionForm>
        </div>
      )

    case 'to_edit':
    case 'changes_requested':
      if (me.role !== 'editor' && !isLead) return null
      return (
        <ActionForm action={submitForReview} className="card space-y-3">
          {hidden}
          <label className="label">Google Drive link to the edit</label>
          <PasteLinkField name="drive_link" placeholder="https://drive.google.com/…" />
          {openCount > 0 && (
            <p className="text-sm font-bold text-grey">
              Tick every comment first. {openCount} left.
            </p>
          )}
          <SubmitButton pendingText="Sending…" disabled={openCount > 0}>
            Ready for review
          </SubmitButton>
        </ActionForm>
      )

    case 'in_review':
      if (!isLead) return null
      return (
        <div className="card">
          <ReviewPanel videoId={video.id} />
        </div>
      )

    case 'approved':
      if (!isLead) return null
      return (
        <ActionForm action={markPosted} className="card space-y-3">
          {hidden}
          <label className="label">Live post link (optional)</label>
          <PasteLinkField name="posted_link" placeholder="https://instagram.com/…" />
          <SubmitButton className="btn-primary" pendingText="Saving…">
            Posted
          </SubmitButton>
        </ActionForm>
      )

    default:
      return null
  }
}
