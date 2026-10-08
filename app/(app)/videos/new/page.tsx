import Link from 'next/link'
import { requireLead } from '@/lib/data'
import { loadVideoFormData } from '@/lib/form-data'
import { VideoForm } from '@/components/video-form'
import { PageBand } from '@/components/top-bar'
import { SlidesImport } from '@/components/videos/slides-import'
import { loadTodos } from '@/lib/todos'

// Reading a big deck from Google can take a few seconds
export const maxDuration = 60

export default async function NewVideoPage() {
  const { supabase } = await requireLead()
  const [formData, { sections }] = await Promise.all([loadVideoFormData(supabase), loadTodos(supabase)])
  return (
    <>
      <PageBand title="New video" />
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        <Link href="/board" className="text-sm font-bold text-blue">
          ‹ Back
        </Link>
        <SlidesImport sections={sections} defaultDestination="videos" />
        <details className="card">
          <summary className="label-caps cursor-pointer text-xs text-grey">Or add just one video</summary>
          <div className="mt-4">
            <VideoForm {...formData} />
          </div>
        </details>
      </main>
    </>
  )
}
