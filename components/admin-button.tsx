import Link from 'next/link'
import { Settings } from 'lucide-react'

// Tribuo blue pill with a gear. Only shown to the Head of Marketing.
export function AdminButton() {
  return (
    <Link
      href="/admin"
      className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-blue px-3.5 text-sm font-bold text-white"
    >
      <Settings aria-hidden className="size-4" />
      Admin
    </Link>
  )
}
