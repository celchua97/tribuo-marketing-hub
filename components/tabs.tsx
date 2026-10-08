'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/board', label: 'Your list' },
  { href: '/shoot-days', label: 'Shoot days' },
  { href: '/videos', label: 'All videos' },
]

// Active tab is white on the blue band; the others are outlined.
export function Tabs() {
  const path = usePathname()
  const active = (href: string) =>
    href === '/board' ? path === '/board' || path.startsWith('/videos/') : path === href || path.startsWith(href + '/')
  return (
    <nav aria-label="Sections" className="flex justify-center gap-1.5 sm:gap-2">
      {TABS.map((t) => {
        // "All videos" owns /videos exactly; single videos belong to "Your list"
        const on = t.href === '/videos' ? path === '/videos' : active(t.href)
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? 'page' : undefined}
            className={`label-caps inline-flex min-h-11 items-center whitespace-nowrap rounded-full border-2 px-3.5 text-[11px] transition sm:px-5 sm:text-xs ${
              on ? 'border-white bg-white text-blue' : 'border-white/40 text-white'
            }`}
          >
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}
