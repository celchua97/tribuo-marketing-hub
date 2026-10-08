import Link from 'next/link'
import { Logo } from './logo'
import { Tabs } from './tabs'

// Slim off-white bar with the logo on the left. `children` sits on the right.
export function TopBar({ children }: { children?: React.ReactNode }) {
  return (
    <header className="bg-canvas">
      <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3">
        <Link href="/" aria-label="Home">
          <Logo />
        </Link>
        <div className="flex items-center gap-1 text-sm text-grey">{children}</div>
      </div>
    </header>
  )
}

// Full-width Tribuo blue band with a big centred white title.
export function PageBand({
  title,
  kicker,
  nav = true,
}: {
  title: string
  kicker?: string
  nav?: boolean
}) {
  return (
    <section className="bg-blue px-4 pt-7 pb-6 text-center text-white">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          {kicker && <p className="label-caps mb-3 text-xs text-white/80">{kicker}</p>}
          <h1 className="title text-[2rem] sm:text-5xl">{title}</h1>
        </div>
        {nav && <Tabs />}
      </div>
    </section>
  )
}
