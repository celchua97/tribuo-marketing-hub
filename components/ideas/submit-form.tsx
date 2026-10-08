'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { prepareUploads, submitIdea } from '@/app/ideas/actions'
import { ACCEPT, AREAS, BUCKET, DOC_TYPES, IMAGE_TYPES, KINDS, MAX_FILES, MAX_FILE_BYTES, type Kind } from '@/lib/ideas-shared'

type Picked = { id: string; file: File; preview: string | null }

const ext = (name: string) => (name.split('.').pop() ?? 'file').slice(0, 4).toUpperCase()

// Screenshots are shrunk in the browser before they go anywhere.
async function compress(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * scale)
    canvas.height = Math.round(bmp.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.82))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    return file
  }
}

export function SubmitForm({ uploads }: { uploads: { url: string; key: string } | null }) {
  const [kind, setKind] = useState<Kind | ''>('')
  const [area, setArea] = useState('')
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  const [files, setFiles] = useState<Picked[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fileNote, setFileNote] = useState('')
  const [sent, setSent] = useState<Kind | null>(null)
  const [dragging, setDragging] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const count = useRef(0)

  async function addFiles(list: File[]) {
    setFileNote('')
    const next: Picked[] = []
    for (const original of list) {
      if (files.length + next.length >= MAX_FILES) {
        setFileNote(`That’s ${MAX_FILES} files. Remove one to add another.`)
        break
      }
      if (![...IMAGE_TYPES, ...DOC_TYPES].includes(original.type)) {
        setFileNote(`“${original.name}” isn’t a type we can take. Use a screenshot, PDF, Word or PowerPoint.`)
        continue
      }
      const file = await compress(original)
      if (file.size > MAX_FILE_BYTES) {
        setFileNote(`“${original.name}” is over 5 MB. Try a smaller file.`)
        continue
      }
      next.push({ id: `${Date.now()}-${count.current++}`, file, preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null })
    }
    if (next.length) setFiles((f) => [...f, ...next])
  }

  // Paste a screenshot anywhere on the page
  const addRef = useRef(addFiles)
  addRef.current = addFiles
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const pasted = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'))
      if (pasted.length === 0) return
      e.preventDefault()
      addRef.current(pasted.map((f, i) => new File([f], `Screenshot ${i + 1}.${f.type.split('/')[1] || 'png'}`, { type: f.type })))
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!kind) return setError('Pick Idea or Feedback first.')
    if (!area) return setError('Pick an area.')
    if (!title.trim()) return setError('Add a few words to say what it is.')

    setBusy(true)
    try {
      const sent_files: { path: string; name: string; mime: string; size: number }[] = []
      if (files.length) {
        if (!uploads) return setError('Attachments aren’t switched on yet. Remove the files to send this without them.')
        const prep = await prepareUploads(files.map((f) => ({ name: f.file.name, type: f.file.type, size: f.file.size })))
        if (prep.error || !prep.uploads) return setError(prep.error ?? 'Something went wrong with the files. Try again.')
        const storage = createClient(uploads.url, uploads.key, { auth: { persistSession: false, autoRefreshToken: false } }).storage.from(BUCKET)
        for (let i = 0; i < files.length; i++) {
          const { path, token } = prep.uploads[i]
          const f = files[i].file
          const { error: upErr } = await storage.uploadToSignedUrl(path, token, f, { contentType: f.type })
          if (upErr) return setError(`We couldn’t upload “${f.name}”. Check your connection and try again.`)
          sent_files.push({ path, name: f.name, mime: f.type, size: f.size })
        }
      }
      const res = await submitIdea({ kind, area, title, details, files: sent_files })
      if (res.error) return setError(res.error)
      files.forEach((f) => f.preview && URL.revokeObjectURL(f.preview))
      setSent(kind)
      setKind('')
      setArea('')
      setTitle('')
      setDetails('')
      setFiles([])
    } catch {
      setError('Something went wrong. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <div className="card space-y-4 text-center">
        <p className="title text-2xl">Thanks! Your {sent === 'idea' ? 'idea' : 'feedback'} is in.</p>
        <p className="text-grey">You can follow what happens to it under Your submissions.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/ideas/mine" className="btn-primary">
            See your submissions
          </Link>
          <button type="button" className="btn-ghost" onClick={() => setSent(null)}>
            Add another
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-6">
      <div>
        <span className="label">What is it?</span>
        <div className="grid grid-cols-2 gap-3">
          {KINDS.map((k) => {
            const on = kind === k.value
            return (
              <button
                key={k.value}
                type="button"
                aria-pressed={on}
                onClick={() => setKind(k.value)}
                className={`rounded-[18px] border-2 p-4 text-left transition active:scale-[0.98] ${
                  on ? (k.value === 'idea' ? 'border-yellow bg-yellow' : 'border-coral bg-coral') : 'border-beige bg-transparent'
                }`}
              >
                <span className="title block text-xl">{k.label}</span>
                <span className="mt-1 block text-sm text-ink/80">{k.blurb}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="area">
          Which area?
        </label>
        <select id="area" className="field" value={area} onChange={(e) => setArea(e.target.value)}>
          <option value="" disabled>
            Pick one
          </option>
          {AREAS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="title">
          In a few words
        </label>
        <input id="title" className="field" maxLength={140} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div>
        <label className="label" htmlFor="details">
          Tell us more (optional)
        </label>
        <textarea id="details" rows={5} className="field" maxLength={4000} value={details} onChange={(e) => setDetails(e.target.value)} />
      </div>

      <div className="space-y-3">
        <span className="label">Add files (optional)</span>
        {uploads ? (
          <>
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragging(false)
                addFiles([...e.dataTransfer.files])
              }}
              className={`rounded-[18px] border-2 border-dashed p-5 text-center transition ${dragging ? 'border-blue bg-sand' : 'border-beige'}`}
            >
              <p className="text-grey">Drag files here, paste a screenshot, or</p>
              <button type="button" className="chip mt-3" onClick={() => input.current?.click()}>
                Choose files
              </button>
              <p className="mt-3 text-sm text-grey">Up to {MAX_FILES}. Screenshots, PDF, Word or PowerPoint, up to 5 MB each.</p>
              <input
                ref={input}
                type="file"
                multiple
                accept={ACCEPT}
                className="sr-only"
                aria-label="Choose files"
                onChange={(e) => {
                  addFiles([...(e.target.files ?? [])])
                  e.target.value = ''
                }}
              />
            </div>
            {fileNote && <p className="text-sm font-bold text-grey">{fileNote}</p>}
            {files.length > 0 && (
              <ul className="flex flex-wrap gap-3">
                {files.map((f) => (
                  <li key={f.id} className="relative">
                    <span className="flex size-20 items-center justify-center overflow-hidden rounded-xl bg-canvas">
                      {f.preview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={f.preview} alt={f.file.name} className="size-full object-cover" />
                      ) : (
                        <span className="label-caps text-[11px] text-grey">{ext(f.file.name)}</span>
                      )}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${f.file.name}`}
                      onClick={() => setFiles((all) => all.filter((x) => x.id !== f.id))}
                      className="absolute -top-2 -right-2 flex size-7 items-center justify-center rounded-full bg-ink text-sm text-white"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-grey">Attachments aren’t switched on yet. You can still send your idea without files.</p>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-xl border-2 border-beige bg-white px-4 py-3 text-sm font-bold text-danger">
          {error}
        </p>
      )}
      <button className="btn-primary" disabled={busy}>
        {busy ? 'Sending…' : 'Send it in'}
      </button>
    </form>
  )
}
