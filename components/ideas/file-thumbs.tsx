'use client'

import { useEffect, useState } from 'react'
import type { IdeaFile } from '@/lib/ideas-shared'

const ext = (name: string) => (name.split('.').pop() ?? 'file').slice(0, 4).toUpperCase()
const isImage = (f: { mime: string }) => f.mime.startsWith('image/')
const size = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`)

// Thumbnails for an entry's files. Tap one for a larger preview with a Download button.
export function FileThumbs({ files }: { files: IdeaFile[] }) {
  const [open, setOpen] = useState<IdeaFile | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  if (files.length === 0) return null
  return (
    <>
      <ul className="flex flex-wrap gap-2">
        {files.map((f) => (
          <li key={f.id}>
            <button
              type="button"
              onClick={() => setOpen(f)}
              aria-label={`Preview ${f.name}`}
              className="flex size-20 items-center justify-center overflow-hidden rounded-xl bg-canvas text-center"
            >
              {isImage(f) && f.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.url} alt={f.name} className="size-full object-cover" />
              ) : (
                <span className="label-caps px-1 text-[11px] text-grey">{ext(f.name)}</span>
              )}
            </button>
          </li>
        ))}
      </ul>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={open.name}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4"
          onClick={() => setOpen(null)}
        >
          <div className="w-full max-w-lg space-y-4 rounded-[18px] bg-white p-4" onClick={(e) => e.stopPropagation()}>
            {isImage(open) && open.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={open.url} alt={open.name} className="mx-auto max-h-[60dvh] w-auto max-w-full rounded-xl" />
            ) : (
              <div className="rounded-xl bg-canvas p-8 text-center">
                <p className="title text-3xl">{ext(open.name)}</p>
                <p className="mt-2 text-grey">No preview for this kind of file. Download it to open it.</p>
              </div>
            )}
            <p className="break-words text-sm text-grey">
              {open.name} · {size(open.size)}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {open.downloadUrl ? (
                <a href={open.downloadUrl} className="btn-primary">
                  Download
                </a>
              ) : (
                <p className="text-sm text-grey">This file isn’t available right now.</p>
              )}
              <button type="button" className="btn-ghost" onClick={() => setOpen(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
