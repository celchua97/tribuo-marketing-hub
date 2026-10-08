'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Logo } from '../logo'

type Item = { href: string; label: string; active: (path: string) => boolean }

const exact = (href: string) => (p: string) => p === href
const prefix = (href: string) => (p: string) => p === href || p.startsWith(href + '/')

const HOME: Item = { href: '/', label: 'Hub home', active: exact('/') }
const GROUPS: { title: string; blurb: string; items: Item[] }[] = [
  {
    title: 'Content workflow board',
    blurb: 'Marketing content progress: shoots, edits, approvals',
    items: [
      { href: '/board', label: 'Your list', active: (p) => p === '/board' || p.startsWith('/videos/') },
      { href: '/shoot-days', label: 'Shoot days', active: prefix('/shoot-days') },
      { href: '/videos', label: 'All videos', active: exact('/videos') },
    ],
  },
  {
    title: 'Idea Bank',
    blurb: 'Ideas and feedback from the team',
    items: [
      { href: '/ideas', label: 'Submit', active: exact('/ideas') },
      { href: '/ideas/mine', label: 'Your submissions', active: exact('/ideas/mine') },
    ],
  },
]
const ADMIN: { title: string; blurb: string; items: Item[] } = {
  title: 'Admin',
  blurb: 'Only you can see this',
  items: [
    { href: '/admin', label: 'Ideas and people', active: prefix('/admin') },
    { href: '/settings', label: 'Board settings', active: prefix('/settings') },
  ],
}

// The Hub menu. It slides in from the left over the page, so nothing jumps.
// On a phone: tap the menu button, or swipe right (start anywhere in the left
// part of the screen). On a laptop or desktop with a mouse: move the pointer to
// the left edge and it appears; move away and it tucks back out of sight.
const DESK = '(min-width: 1024px) and (hover: hover) and (pointer: fine)'
export function HubMenu({ isAdmin = false, who }: { isAdmin?: boolean; who?: string }) {
  const path = usePathname()
  const [open, setOpen] = useState(false) // phone: slid in
  const [peek, setPeek] = useState(false) // laptop: pointer is on the menu or the left edge
  const openRef = useRef(false)
  const panel = useRef<HTMLElement>(null)
  const leaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  openRef.current = open

  const showPeek = () => {
    clearTimeout(leaveTimer.current)
    setPeek(true)
  }
  const hidePeekSoon = () => {
    clearTimeout(leaveTimer.current)
    leaveTimer.current = setTimeout(() => setPeek(false), 300)
  }

  // Close when you go somewhere
  useEffect(() => {
    setOpen(false)
    setPeek(false)
  }, [path])

  // Swipe right to open, swipe left to close
  useEffect(() => {
    let sx = 0
    let sy = 0
    let tracking = false
    const wide = () => window.matchMedia(DESK).matches
    const onStart = (e: TouchEvent) => {
      if (wide() || e.touches.length !== 1) return
      const t = e.touches[0]
      sx = t.clientX
      sy = t.clientY
      const el = e.target instanceof Element ? e.target : null
      const inField = el?.closest('input, textarea, select, [data-no-swipe]')
      tracking = !inField && (openRef.current || sx < window.innerWidth * 0.4)
    }
    const onEnd = (e: TouchEvent) => {
      if (!tracking) return
      tracking = false
      const t = e.changedTouches[0]
      const dx = t.clientX - sx
      const dy = t.clientY - sy
      if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2) return
      if (!openRef.current && dx > 0) setOpen(true)
      else if (openRef.current && dx < 0) setOpen(false)
    }
    document.addEventListener('touchstart', onStart, { passive: true })
    document.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      document.removeEventListener('touchstart', onStart)
      document.removeEventListener('touchend', onEnd)
    }
  }, [])

  // Escape closes; on a phone the page behind doesn't scroll while the menu is open
  useEffect(() => {
    if (!open && !peek) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setPeek(false)
      }
    }
    document.addEventListener('keydown', onKey)
    const wasOverflow = document.body.style.overflow
    if (open && !window.matchMedia(DESK).matches) document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = wasOverflow
    }
  }, [open, peek])

  // Moving focus into the menu once it is showing (phone button or keyboard)
  useEffect(() => {
    if (open || peek) panel.current?.focus()
  }, [open, peek])

  const groups = isAdmin ? [...GROUPS, ADMIN] : GROUPS
  const link = (i: Item) => {
    const on = i.active(path)
    return (
      <Link
        key={i.href}
        href={i.href}
        aria-current={on ? 'page' : undefined}
        className={`flex min-h-12 items-center rounded-full px-4 font-bold transition ${
          on ? 'bg-blue text-white' : 'text-ink hover:bg-white'
        }`}
      >
        {i.label}
      </Link>
    )
  }

  return (
    <>
      <button
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="hub-menu"
        onClick={() => (window.matchMedia(DESK).matches ? setPeek(true) : setOpen(true))}
        className="-ml-2 flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-white desk:sr-only desk:focus:not-sr-only"
      >
        <svg aria-hidden viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-ink/50 transition-opacity duration-200 desk:hidden ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      />

      {/* Laptop: a thin strip along the left edge that wakes the menu when the pointer touches it */}
      <div
        aria-hidden
        onMouseEnter={showPeek}
        onMouseLeave={hidePeekSoon}
        className="fixed inset-y-0 left-0 z-40 hidden w-4 desk:block"
      >
        <span
          className={`absolute top-1/2 left-0 h-16 w-1.5 -translate-y-1/2 rounded-r-full bg-beige transition-opacity duration-200 ${peek ? 'opacity-0' : 'opacity-100'}`}
        />
      </div>

      <aside
        id="hub-menu"
        ref={panel}
        tabIndex={-1}
        aria-label="Hub menu"
        data-open={open}
        data-peek={peek}
        onMouseEnter={showPeek}
        onMouseLeave={hidePeekSoon}
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col gap-6 overflow-y-auto bg-canvas p-5 outline-none transition-[transform,visibility] duration-200 ease-out motion-reduce:transition-none desk:border-r desk:border-beige desk:data-[peek=false]:invisible desk:data-[peek=false]:-translate-x-full desk:data-[peek=true]:visible desk:data-[peek=true]:translate-x-0 ${
          open ? 'visible translate-x-0' : 'invisible -translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <Link href="/" aria-label="Hub home">
            <Logo />
          </Link>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="flex size-11 items-center justify-center rounded-full text-xl hover:bg-white desk:hidden"
          >
            ×
          </button>
        </div>

        <div>
          <p className="title text-2xl">Tribuo Hub</p>
          {who && <p className="mt-1 text-sm text-grey">{who}</p>}
        </div>

        <nav aria-label="Hub sections" className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">{link(HOME)}</div>
          {groups.map((g) => (
            <div key={g.title} className="flex flex-col gap-1">
              <p className="label-caps px-4 text-[11px] text-grey">{g.title}</p>
              <p className="px-4 pb-1 text-xs text-grey">{g.blurb}</p>
              {g.items.map(link)}
            </div>
          ))}
        </nav>
      </aside>
    </>
  )
}
