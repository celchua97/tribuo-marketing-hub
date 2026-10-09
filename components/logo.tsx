import { LOGO_SRC } from '@/lib/brand'

export function Logo({ className = 'h-8 w-auto' }: { className?: string }) {
  if (LOGO_SRC) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={LOGO_SRC} alt="tribuo." className={className} />
  }
  // Stand-in until the official logo file is added (see lib/brand.ts).
  return (
    <span className="label-caps whitespace-nowrap rounded-full border-2 border-dashed border-beige px-3 py-1.5 text-[11px] text-grey">
      Logo here
    </span>
  )
}
