'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Pill tabs for the blue band: white fill when selected, white outline otherwise.
export function PillTabs({ items, label }: { items: { href: string; label: string }[]; label: string }) {
  const path = usePathname()
  return (
    <nav aria-label={label} className="flex justify-center gap-1.5 sm:gap-2">
      {items.map((t) => {
        const on = path === t.href
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? 'page' : undefined}
            className={`label-caps inline-flex min-h-11 items-center whitespace-nowrap rounded-full border-2 px-4 text-[11px] transition sm:px-5 sm:text-xs ${
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
