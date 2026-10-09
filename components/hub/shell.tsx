'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Logo } from '../logo'

type Item = { href: string; label: string; icon: React.ReactNode; active: (p: string) => boolean }

const svg = (d: React.ReactNode) => (
  <svg aria-hidden viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
)

const ITEMS: Item[] = [
  { href: '/', label: 'Dashboard', active: (p) => p === '/', icon: svg(<><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>) },
  { href: '/todos', label: 'To-dos', active: (p) => p.startsWith('/todos'), icon: svg(<><path d="M9 6h11M9 12h11M9 18h11" /><path d="M3.5 6l1.5 1.5L7.5 5M3.5 12l1.5 1.5L7.5 11M3.5 18l1.5 1.5L7.5 17" /></>) },
  { href: '/ideas', label: 'Idea Bank', active: (p) => p.startsWith('/ideas'), icon: svg(<><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" /></>) },
]
const ADMIN: Item = {
  href: '/admin',
  label: 'Admin',
  active: (p) => p.startsWith('/admin') || p.startsWith('/settings'),
  icon: svg(<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>),
}

// A fixed sidebar on laptops, a tab bar along the bottom on phones. No hiding, no hovering.
export function Shell({ isAdmin, who, children }: { isAdmin: boolean; who?: string; children: React.ReactNode }) {
  const path = usePathname()
  if (path.startsWith('/who') || path === '/login') return <>{children}</>
  const items = isAdmin ? [...ITEMS, ADMIN] : ITEMS

  return (
    <div className="has-sidebar pb-20 lg:pb-0 lg:pl-60">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-blue px-4 py-6 text-white lg:flex">
        <Link href="/" aria-label="Hub home" className="mb-8 px-2">
          <Logo className="h-8 w-auto brightness-0 invert" />
        </Link>
        <nav aria-label="Main" className="space-y-1.5">
          {items.map((i) => {
            const on = i.active(path)
            return (
              <Link
                key={i.href}
                href={i.href}
                aria-current={on ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-[15px] font-bold transition-colors ${on ? 'bg-white text-blue' : 'text-white/85 hover:bg-white/15'}`}
              >
                {i.icon}
                {i.label}
              </Link>
            )
          })}
        </nav>
        {who && (
          <div className="mt-auto flex items-center justify-between gap-2 rounded-xl bg-white/10 px-3.5 py-3 text-sm">
            <span className="min-w-0 truncate font-bold">{who}</span>
            <Link href="/who" className="shrink-0 text-white/80 underline">
              Switch
            </Link>
          </div>
        )}
      </aside>

      {children}

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-beige bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        <ul className={`mx-auto grid max-w-md ${items.length === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
          {items.map((i) => {
            const on = i.active(path)
            return (
              <li key={i.href}>
                <Link href={i.href} aria-current={on ? 'page' : undefined} className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-bold ${on ? 'text-blue' : 'text-grey'}`}>
                  {i.icon}
                  {i.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
