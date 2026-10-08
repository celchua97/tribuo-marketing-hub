'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { addVideosFromSlides, extractSlides } from '@/app/(app)/actions'
import { MARKET_FLAG, MARKET_NAME } from '@/lib/labels'
import type { Market } from '@/lib/types'

type Row = { id: number; text: string; checked: boolean }

// Paste a Google Slides link (or choose a PowerPoint file). We read each slide's
// title, drop repeats, and show them as a checklist. Tick the ones to add.
export function SlidesImport() {
  const [market, setMarket] = useState<Market>('MY')
  const [link, setLink] = useState('')
  const [fileName, setFileName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [slideCount, setSlideCount] = useState(0)
  const [savedLink, setSavedLink] = useState('')
  const [done, setDone] = useState<{ added: number; skipped: number } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const chosen = (rows ?? []).filter((r) => r.checked && r.text.trim())

  async function find(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const fd = new FormData()
      fd.set('slides_url', link)
      const file = fileInput.current?.files?.[0]
      if (file) fd.set('file', file)
      const res = await extractSlides(fd)
      if (res.error || !res.titles) {
        setError(res.error ?? 'Something went wrong. Try again.')
        return
      }
      setRows(res.titles.map((t, i) => ({ id: i, text: t, checked: true })))
      setSlideCount(res.slides ?? 0)
      setSavedLink(res.link ?? '')
    } catch {
      setError('Something went wrong. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  async function add() {
    setError('')
    setBusy(true)
    try {
      const res = await addVideosFromSlides({ market, titles: chosen.map((r) => r.text), link: savedLink })
      if (res.error) {
        setError(res.error)
        return
      }
      setDone({ added: res.added ?? 0, skipped: res.skipped ?? 0 })
    } catch {
      setError('Something went wrong. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setRows(null)
    setDone(null)
    setError('')
    setLink('')
    setFileName('')
    if (fileInput.current) fileInput.current.value = ''
  }

  if (done) {
    return (
      <section className="card space-y-4 text-center">
        <p className="title text-2xl">
          {done.added === 0 ? 'Nothing new to add.' : `${done.added} video${done.added === 1 ? '' : 's'} added.`}
        </p>
        <p className="text-grey">
          {done.skipped > 0 && `${done.skipped} ${done.skipped === 1 ? 'was' : 'were'} already on the board, so we left ${done.skipped === 1 ? 'it' : 'them'} out. `}
          {done.added > 0 && 'They are on your list under Unscheduled, ready to be put on a Shoot Day.'}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/board" className="btn-primary">
            See your list
          </Link>
          <button type="button" className="btn-ghost" onClick={reset}>
            Add from another deck
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="card space-y-5">
      <h2 className="label-caps text-xs text-grey">Add videos from Google Slides</h2>

      {!rows ? (
        <form onSubmit={find} className="space-y-5">
          <div>
            <span className="label">Market</span>
            <div className="flex gap-2">
              {(['MY', 'KH'] as Market[]).map((m) => (
                <button
                  type="button"
                  key={m}
                  onClick={() => setMarket(m)}
                  aria-pressed={market === m}
                  className={`chip flex-1 justify-center ${market === m ? 'chip-on' : ''}`}
                >
                  {MARKET_FLAG[m]} {MARKET_NAME[m]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label" htmlFor="slides_url">
              Google Slides link
            </label>
            <input
              id="slides_url"
              className="field"
              type="url"
              inputMode="url"
              placeholder="https://docs.google.com/presentation/d/…"
              value={link}
              onChange={(e) => setLink(e.target.value)}
            />
            <p className="mt-2 text-sm text-grey">
              In Google Slides, tap Share and set “Anyone with the link” to Viewer, so we can read the titles.
            </p>
          </div>

          <div>
            <span className="label">Or a PowerPoint file</span>
            <button type="button" className="chip" onClick={() => fileInput.current?.click()}>
              {fileName ? `Chosen: ${fileName}` : 'Choose a .pptx file'}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              className="sr-only"
              aria-label="Choose a PowerPoint file"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')}
            />
            <p className="mt-2 text-sm text-grey">In Google Slides: File, Download, Microsoft PowerPoint. Up to 4 MB.</p>
          </div>

          {error && (
            <p role="alert" className="rounded-xl border-2 border-beige bg-white px-4 py-3 text-sm font-bold text-danger">
              {error}
            </p>
          )}
          <button className="btn-primary" disabled={busy || (!link.trim() && !fileName)}>
            {busy ? 'Reading the slides…' : 'Find the titles'}
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <p className="text-grey">
            Found <strong className="text-ink">{rows.length}</strong> title{rows.length === 1 ? '' : 's'} in {slideCount} slide
            {slideCount === 1 ? '' : 's'}. Repeats are left out. Untick any you don’t want, or fix a title.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="chip min-h-10 text-xs" onClick={() => setRows(rows.map((r) => ({ ...r, checked: true })))}>
              Tick all
            </button>
            <button type="button" className="chip min-h-10 text-xs" onClick={() => setRows(rows.map((r) => ({ ...r, checked: false })))}>
              Untick all
            </button>
            <span className="text-sm text-grey">
              Goes on the {MARKET_FLAG[market]} {MARKET_NAME[market]} board
            </span>
          </div>

          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-xl bg-canvas px-3 py-2">
                <input
                  type="checkbox"
                  aria-label={`Add “${r.text}”`}
                  checked={r.checked}
                  onChange={(e) => setRows(rows.map((x) => (x.id === r.id ? { ...x, checked: e.target.checked } : x)))}
                  className="size-7 shrink-0 accent-[#3750ab]"
                />
                <input
                  aria-label="Title"
                  className={`min-w-0 flex-1 bg-transparent py-2 outline-none ${r.checked ? '' : 'text-grey line-through'}`}
                  value={r.text}
                  maxLength={140}
                  onChange={(e) => setRows(rows.map((x) => (x.id === r.id ? { ...x, text: e.target.value } : x)))}
                />
              </li>
            ))}
          </ul>

          {error && (
            <p role="alert" className="rounded-xl border-2 border-beige bg-white px-4 py-3 text-sm font-bold text-danger">
              {error}
            </p>
          )}
          <button type="button" className="btn-primary" disabled={busy || chosen.length === 0} onClick={add}>
            {busy ? 'Adding…' : `Add ${chosen.length} video${chosen.length === 1 ? '' : 's'}`}
          </button>
          <button type="button" className="w-full py-2 text-sm font-bold text-grey" onClick={reset}>
            Start again
          </button>
        </div>
      )}
    </section>
  )
}
