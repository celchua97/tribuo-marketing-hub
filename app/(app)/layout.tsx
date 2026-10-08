import Link from 'next/link'
import { requireMe } from '@/lib/data'
import { ROLE_LABEL } from '@/lib/labels'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { me } = await requireMe()
  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 pb-16">
      <header className="flex items-center justify-between gap-3 py-4">
        <Link href="/" className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-blue uppercase">Tribuo content</p>
          <p className="truncate font-semibold">{me.full_name}</p>
          <p className="truncate text-xs text-ink/50">{ROLE_LABEL[me.role]}</p>
        </Link>
        <nav className="flex shrink-0 items-center gap-1 text-sm">
          {me.role === 'lead' && (
            <Link href="/settings" className="rounded-lg px-3 py-2 text-ink/70 hover:bg-white">
              Settings
            </Link>
          )}
          <form action="/auth/signout" method="post">
            <button className="rounded-lg px-3 py-2 text-ink/70 hover:bg-white">Sign out</button>
          </form>
        </nav>
      </header>
      {children}
    </div>
  )
}
