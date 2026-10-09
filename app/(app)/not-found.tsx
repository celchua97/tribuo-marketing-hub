import Link from 'next/link'
import { PageBand } from '@/components/top-bar'

export default function NotFound() {
  return (
    <>
      <PageBand title="Not found" />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <div className="card space-y-3 text-center">
          <p className="font-bold">That video doesn&rsquo;t exist any more.</p>
          <Link href="/" className="btn-primary">
            Back to the Hub
          </Link>
        </div>
      </main>
    </>
  )
}
