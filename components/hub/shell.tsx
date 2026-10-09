'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Lightbulb, ListChecks, ShieldCheck } from 'lucide-react'
import { Logo } from '../logo'

type Item = { href: string; label: string; icon: React.ReactNode; active: (p: string) => boolean }

const ITEMS: Item[] = [
  { href: '/', label: 'Dashboard', active: (p) => p === '/', icon: <LayoutDashboard className="size-5 shrink-0" aria-hidden /> },
  { href: '/todos', label: 'To-dos', active: (p) => p.startsWith('/todos'), icon: <ListChecks className="size-5 shrink-0" aria-hidden /> },
  { href: '/ideas', label: 'Idea Bank', active: (p) => p.startsWith('/ideas'), icon: <Lightbulb className="size-5 shrink-0" aria-hidden /> },
]
const ADMIN: Item = {
  href: '/admin',
  label: 'Admin',
  active: (p) => p.startsWith('/admin') || p.startsWith('/settings'),
  icon: <ShieldCheck className="size-5 shrink-0" aria-hidden />,
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
