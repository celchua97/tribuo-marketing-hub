'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { addVideosFromSlides, extractSlides } from '@/app/(app)/actions'
import { addTodosFromSlides } from '@/app/(app)/todos/actions'
import type { TodoSection } from '@/lib/todos'
import { MARKET_FLAG, MARKET_NAME } from '@/lib/labels'
import type { Market } from '@/lib/types'

type Row = { id: number; text: string; checked: boolean }

// Paste a Google Slides link (or choose a PowerPoint file). We read each slide's
// title, drop repeats, and show them as a checklist. Tick the ones to add.
export function SlidesImport({
  sections,
  defaultDestination = 'videos',
  bare = false,
}: {
  sections: TodoSection[]
  defaultDestination?: 'todos' | 'videos'
  bare?: boolean // no card around it (when it sits inside another card)
}) {
  const [destination, setDestination] = useState<'todos' | 'videos'>(defaultDestination)
  const [sectionId, setSectionId] = useState(sections[0]?.id ?? '__new__')
  const [newSection, setNewSection] = useState('')
  const [market, setMarket] = useState<Market>('MY')
  const [link, setLink] = useState('')
  const [fileName, setFileName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [slideCount, setSlideCount] = useState(0)
  const [savedLink, setSavedLink] = useState('')
  const [done, setDone] = useState<{ added: number; skipped: number; where?: string } | null>(null)
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
      if (destination === 'todos') {
        if (sectionId === '__new__' && !newSection.trim()) {
          setError('Give the new section a name.')
          return
        }
        const res = await addTodosFromSlides({ sectionId, newSection, titles: chosen.map((r) => r.text), link: savedLink })
        if (res.error) {
          setError(res.error)
          return
        }
        setDone({ added: res.added ?? 0, skipped: res.skipped ?? 0, where: res.sectionName })
        return
      }
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

  const shell = bare ? 'space-y-5' : 'card space-y-5'

  if (done) {
    const noun = destination === 'todos' ? 'to-do' : 'video'
    return (
      <div className={shell}>
        <div className="space-y-4 text-center">
          <p className="title text-2xl">
            {done.added === 0
              ? 'Nothing new to add.'
              : `${done.added} ${noun}${done.added === 1 ? '' : 's'} added${done.where ? ` to ${done.where}` : ''}.`}
          </p>
          <p className="text-grey">
            {done.skipped > 0 &&
              `${done.skipped} ${done.skipped === 1 ? 'was' : 'were'} already ${destination === 'todos' ? 'in that section' : 'on the board'}, so we left ${done.skipped === 1 ? 'it' : 'them'} out. `}
            {done.added > 0 &&
              (destination === 'todos'
                ? 'Find them on the To-do board.'
                : 'They are on your list under Unscheduled, ready to be put on a Shoot Day.')}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link href={destination === 'todos' ? '/todos' : '/board'} className="btn-primary" onClick={() => destination === 'todos' && setTimeout(reset, 50)}>
              {destination === 'todos' ? 'See the to-do board' : 'See your list'}
            </Link>
            <button type="button" className="btn-ghost" onClick={reset}>
              Add from another deck
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={shell}>
      {!bare && <h2 className="label-caps text-xs text-grey">Add from Google Slides</h2>}

      {!rows ? (
        <form onSubmit={find} className="space-y-5">
          <div>
            <span className="label">Where should the titles go?</span>
            <div className="grid grid-cols-2 gap-2">
              {([['todos', 'To-dos in a section'], ['videos', 'Videos on the workflow board']] as const).map(([v, label]) => (
                <button
                  type="button"
                  key={v}
                  aria-pressed={destination === v}
                  onClick={() => setDestination(v)}
                  className={`chip justify-center text-center ${destination === v ? 'chip-on' : ''}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {destination === 'todos' ? (
            <div className="space-y-3">
              <div>
                <label className="label" htmlFor="import_section">
                  Which section?
                </label>
                <select id="import_section" className="field" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
                  {sections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      {sec.name}
                    </option>
                  ))}
                  <option value="__new__">New section…</option>
                </select>
              </div>
              {sectionId === '__new__' && (
                <input
                  aria-label="Name of the new section"
                  className="field"
                  placeholder="Name of the new section"
                  maxLength={60}
                  value={newSection}
                  onChange={(e) => setNewSection(e.target.value)}
                />
              )}
            </div>
          ) : (
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
          )}

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
              {destination === 'todos'
                ? `Goes into ${sectionId === '__new__' ? newSection || 'a new section' : (sections.find((x) => x.id === sectionId)?.name ?? 'a section')}`
                : `Goes on the ${MARKET_FLAG[market]} ${MARKET_NAME[market]} board`}
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
            {busy ? 'Adding…' : `Add ${chosen.length} ${destination === 'todos' ? 'to-do' : 'video'}${chosen.length === 1 ? '' : 's'}`}
          </button>
          <button type="button" className="w-full py-2 text-sm font-bold text-grey" onClick={reset}>
            Start again
          </button>
        </div>
      )}
    </div>
  )
}
