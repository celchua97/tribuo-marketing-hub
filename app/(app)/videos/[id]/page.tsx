import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireMe, VIDEO_WITH_NAMES } from '@/lib/data'
import { eventText } from '@/lib/labels'
import { formatDate, formatDateTime } from '@/lib/dates'
import type { FeedbackComment, Profile, Submission, VideoEvent, VideoWithNames } from '@/lib/types'
import { DueBadge, MarketFlag, StatusPill } from '@/components/badges'
import { ActionForm, SubmitButton } from '@/components/action-form'
import { PasteLinkField } from '@/components/paste-link-field'
import { ReviewPanel } from '@/components/review-panel'
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
  const openComments = (comments ?? []).filter((c) => !c.resolved_at)

  return (
    <main className="space-y-5">
      <div>
        <Link href="/" className="text-sm text-ink/60">
          ‹ Back
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <MarketFlag market={video.market} />
          {video.episode_number && (
            <span className="text-xs font-semibold text-ink/50">Ep {video.episode_number}</span>
          )}
          {video.pillar && <span className="text-xs text-ink/50">{video.pillar.name}</span>}
        </div>
        <h1 className="mt-1 text-2xl leading-tight font-bold">{video.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusPill status={video.status} />
          <DueBadge dueOn={video.due_on} timeZone={tz} />
          {video.assignee && (
            <span className="text-sm text-ink/60">
              {video.assignee_id === me.id ? 'With you' : `With ${video.assignee.full_name}`}
            </span>
          )}
        </div>
      </div>

      <ActionPanel video={video} me={me} />

      {openComments.length > 0 && (
        <section className="card">
          <h2 className="mb-3 font-semibold">
            Changes to make <span className="text-ink/50">({openComments.length})</span>
          </h2>
          <ul className="space-y-2">
            {openComments.map((c) => (
              <li key={c.id} className="flex gap-3 rounded-xl bg-canvas px-3 py-3">
                {c.timecode && (
                  <span className="shrink-0 rounded-md bg-ink px-2 py-0.5 font-mono text-sm text-white">
                    {c.timecode}
                  </span>
                )}
                <span>{c.body}</span>
              </li>
            ))}
          </ul>
        </section>
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
          <h2 className="font-semibold">Brief</h2>
          {me.role === 'lead' && (
            <Link href={`/videos/${id}/edit`} className="text-sm font-semibold text-blue">
              Edit
            </Link>
          )}
        </div>
        {video.brief ? (
          <p className="whitespace-pre-wrap">{video.brief}</p>
        ) : (
          <p className="text-ink/50">No brief yet.</p>
        )}
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-ink/50">Target post date</dt>
            <dd className="font-medium">
              {video.target_post_date ? formatDate(video.target_post_date) : 'Not set'}
            </dd>
          </div>
          {video.reference_link && (
            <div>
              <dt className="text-ink/50">Reference</dt>
              <dd>
                <a href={video.reference_link} target="_blank" rel="noreferrer" className="font-medium text-blue">
                  Open link ↗
                </a>
              </dd>
            </div>
          )}
        </dl>
      </section>

      {(submissions ?? []).length > 1 && (
        <section className="card">
          <h2 className="mb-3 font-semibold">Earlier versions</h2>
          <ul className="space-y-2 text-sm">
            {(submissions ?? []).slice(1).map((s) => (
              <li key={s.id}>
                <a href={s.drive_link} target="_blank" rel="noreferrer" className="text-blue">
                  Version {s.round}
                </a>{' '}
                <span className="text-ink/50">· {formatDateTime(s.submitted_at, tz)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2 className="mb-3 font-semibold">History</h2>
        <ol className="space-y-2 text-sm">
          {(events ?? []).map((e) => (
            <li key={e.id} className="flex justify-between gap-3">
              <span>
                <strong className="font-medium">{e.actor?.full_name ?? 'Someone'}</strong>{' '}
                {eventText(e.kind, e.to_status, e.payload)}
              </span>
              <span className="shrink-0 text-ink/50">{formatDateTime(e.created_at, tz)}</span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  )
}

function ActionPanel({ video, me }: { video: VideoWithNames; me: Profile }) {
  const isLead = me.role === 'lead'
  const hidden = <input type="hidden" name="video_id" value={video.id} />

  switch (video.status) {
    case 'draft':
      return isLead ? (
        <Link href={`/videos/${video.id}/edit`} className="btn-dark">
          Write the brief
        </Link>
      ) : null

    case 'to_shoot':
      if (me.role !== 'videographer' && !isLead) return null
      return (
        <ActionForm action={markShot}>
          {hidden}
          <SubmitButton pendingText="Saving…">✓ Shot</SubmitButton>
        </ActionForm>
      )

    case 'to_edit':
    case 'changes_requested':
      if (me.role !== 'editor' && !isLead) return null
      return (
        <ActionForm action={submitForReview} className="card space-y-3">
          {hidden}
          <label className="label">Google Drive link to the edit</label>
          <PasteLinkField name="drive_link" placeholder="https://drive.google.com/…" />
          <SubmitButton pendingText="Sending…">Ready for review</SubmitButton>
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
          <SubmitButton className="btn-dark" pendingText="Saving…">
            Posted
          </SubmitButton>
        </ActionForm>
      )

    default:
      return null
  }
}
