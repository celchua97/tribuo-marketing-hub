import Link from 'next/link'

const ITEMS = [
  { key: 'ideas', label: 'Ideas', href: '/admin' },
  { key: 'board', label: 'Board', href: '/settings' },
  { key: 'access', label: 'Access', href: '/admin?section=access' },
] as const

// Equal buttons to move between the admin sections. Blue means you are here.
export function AdminSwitcher({ active }: { active: 'ideas' | 'board' | 'access' }) {
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
