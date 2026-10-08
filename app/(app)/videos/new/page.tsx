import Link from 'next/link'
import { requireLead } from '@/lib/data'
import { loadVideoFormData } from '@/lib/form-data'
import { VideoForm } from '@/components/video-form'

export default async function NewVideoPage() {
  const { supabase } = await requireLead()
  const formData = await loadVideoFormData(supabase)
  return (
    <main>
      <Link href="/" className="text-sm text-ink/60">
        ‹ Back
      </Link>
      <h1 className="mt-2 mb-4 text-2xl font-bold">New video</h1>
      <div className="card">
        <VideoForm {...formData} />
      </div>
    </main>
  )
}
