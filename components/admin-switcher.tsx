import Link from 'next/link'

const ITEMS = [
  { key: 'ideas', label: 'Ideas', href: '/admin' },
  { key: 'people', label: 'People', href: '/admin?section=people' },
  { key: 'board', label: 'Board', href: '/settings' },
] as const

// Equal buttons to move between the admin sections. Blue means you are here.
export function AdminSwitcher({ active }: { active: 'ideas' | 'people' | 'board' }) {
  return (
    <nav aria-label="Admin sections" className="grid grid-cols-3 gap-2">
      {ITEMS.map((i) => (
        <Link
          key={i.key}
          href={i.href}
          aria-current={active === i.key ? 'page' : undefined}
          className={`inline-flex min-h-12 items-center justify-center rounded-full border-2 px-2 text-sm font-bold transition ${
            active === i.key ? 'border-blue bg-blue text-white' : 'border-beige text-ink'
          }`}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  )
}
