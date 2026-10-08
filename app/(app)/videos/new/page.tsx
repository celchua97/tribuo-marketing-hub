import Link from 'next/link'
import { requireLead } from '@/lib/data'
import { loadVideoFormData } from '@/lib/form-data'
import { VideoForm } from '@/components/video-form'
import { PageBand } from '@/components/top-bar'

export default async function NewVideoPage() {
  const { supabase } = await requireLead()
  const formData = await loadVideoFormData(supabase)
  return (
    <>
      <PageBand title="New video" />
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        <Link href="/board" className="text-sm font-bold text-blue">
          ‹ Back
        </Link>
        <div className="card">
          <VideoForm {...formData} />
        </div>
      </main>
    </>
  )
}
