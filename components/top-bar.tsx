import Link from 'next/link'
import { Logo } from './logo'
import { Tabs } from './tabs'

// Slim off-white bar with the logo on the left. `children` sits on the right.
export function TopBar({
  children,
  label,
  width = 'max-w-2xl',
}: {
  children?: React.ReactNode
  label?: string
  width?: string
}) {
  return (
    <header className="bg-canvas">
      <div className={`mx-auto flex ${width} flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3`}>
        <div className="flex items-center gap-3">
          <Link href="/" aria-label="Home">
            <Logo />
          </Link>
          {label && (
            <>
              <span aria-hidden className="h-5 w-px bg-beige" />
              <span className="label-caps text-[11px] text-grey">{label}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1 text-sm text-grey">{children}</div>
      </div>
    </header>
  )
}

// Full-width Tribuo blue band with a big centred white title.
// `nav` is the board tabs by default; pass your own tabs, or false for none.
export function PageBand({
  title,
  kicker,
  intro,
  nav = true,
}: {
  title: string
  kicker?: string
  intro?: string
  nav?: boolean | React.ReactNode
}) {
  return (
    <section className="bg-blue px-4 pt-7 pb-6 text-center text-white">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          {kicker && <p className="label-caps mb-3 text-xs text-white/80">{kicker}</p>}
          <h1 className="title text-[2rem] sm:text-5xl">{title}</h1>
          {intro && <p className="mx-auto mt-3 max-w-[46ch] text-[15px] leading-relaxed text-white/90">{intro}</p>}
        </div>
        {nav === true ? <Tabs /> : nav === false ? null : nav}
      </div>
    </section>
  )
}
