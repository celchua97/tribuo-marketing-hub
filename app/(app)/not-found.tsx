import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="card text-center">
      <p className="font-semibold">That video doesn&rsquo;t exist any more.</p>
      <Link href="/" className="mt-3 inline-block text-blue">
        Back to your list
      </Link>
    </main>
  )
}
