import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireLead } from '@/lib/data'
import { loadVideoFormData } from '@/lib/form-data'
import type { Video } from '@/lib/types'
import { VideoForm } from '@/components/video-form'
import { ActionForm, SubmitButton } from '@/components/action-form'
import { deleteVideo } from '../../../actions'

export default async function EditVideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase } = await requireLead()
  const [{ data: video }, formData] = await Promise.all([
    supabase.from('videos').select('*').eq('id', id).maybeSingle<Video>(),
    loadVideoFormData(supabase),
  ])
  if (!video) notFound()

  return (
    <main className="space-y-6">
      <div>
        <Link href={`/videos/${id}`} className="text-sm text-ink/60">
          ‹ Back
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Edit video</h1>
      </div>
      <div className="card">
        <VideoForm video={video} {...formData} />
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-ink/50">Delete this video</summary>
        <ActionForm action={deleteVideo} className="mt-3 space-y-3">
          <input type="hidden" name="video_id" value={id} />
          <p className="text-ink/60">This removes the video and its history for everyone.</p>
          <SubmitButton className="btn-ghost text-red-700" pendingText="Deleting…">
            Delete for good
          </SubmitButton>
        </ActionForm>
      </details>
    </main>
  )
}
