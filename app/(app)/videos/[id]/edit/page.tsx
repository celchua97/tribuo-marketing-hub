import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireLead } from '@/lib/data'
import { loadVideoFormData } from '@/lib/form-data'
import type { Video } from '@/lib/types'
import { VideoForm } from '@/components/video-form'
import { ActionForm, SubmitButton } from '@/components/action-form'
import { PageBand } from '@/components/top-bar'
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
    <>
      <PageBand title="Edit video" />
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        <Link href={`/videos/${id}`} className="text-sm font-bold text-blue">
          ‹ Back
        </Link>
        <div className="card">
          <VideoForm video={video} {...formData} />
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer text-grey">Delete this video</summary>
          <ActionForm action={deleteVideo} className="mt-3 space-y-3">
            <input type="hidden" name="video_id" value={id} />
            <p className="text-grey">This removes the video and its history for everyone.</p>
            <SubmitButton className="btn-ghost" pendingText="Deleting…">
              Delete for good
            </SubmitButton>
          </ActionForm>
        </details>
      </main>
    </>
  )
}
