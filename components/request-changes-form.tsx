'use client'

import { useState } from 'react'
import { requestChanges } from '@/app/(app)/actions'
import { ActionForm, SubmitButton } from './action-form'

type Line = { timecode: string; body: string }

// One comment per line, each with an optional timestamp. Each becomes a
// checkbox on the editor's list.
export function RequestChangesForm({ videoId, onCancel }: { videoId: string; onCancel: () => void }) {
  const [lines, setLines] = useState<Line[]>([{ timecode: '', body: '' }])

  function update(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  }

  const filled = lines.filter((l) => l.body.trim())

  return (
    <ActionForm action={requestChanges} className="space-y-3">
      <input type="hidden" name="video_id" value={videoId} />
      <input type="hidden" name="comments" value={JSON.stringify(filled)} />
      <p className="label-caps text-xs text-grey">What needs changing?</p>
      {lines.map((line, i) => (
        <div key={i} className="flex gap-2">
          <input
            aria-label="Timestamp"
            className="field w-20 shrink-0 px-2 text-center"
            placeholder="0:12"
            inputMode="numeric"
            value={line.timecode}
            onChange={(e) => update(i, { timecode: e.target.value.replace(/[^\d:]/g, '').slice(0, 5) })}
          />
          <input
            aria-label={`Comment ${i + 1}`}
            className="field min-w-0 flex-1"
            placeholder={i === 0 ? 'e.g. Trim the intro' : 'Another comment'}
            value={line.body}
            autoFocus={i === lines.length - 1 && i > 0}
            onChange={(e) => update(i, { body: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (line.body.trim()) setLines((prev) => [...prev, { timecode: '', body: '' }])
              }
            }}
          />
        </div>
      ))}
      <button
        type="button"
        className="chip"
        onClick={() => setLines((prev) => [...prev, { timecode: '', body: '' }])}
      >
        + Add another comment
      </button>
      <SubmitButton className="btn-primary" pendingText="Sending…" disabled={filled.length === 0}>
        Send {filled.length || ''} comment{filled.length === 1 ? '' : 's'} to the editor
      </SubmitButton>
      <button type="button" onClick={onCancel} className="w-full py-2 text-sm text-grey">
        Cancel
      </button>
    </ActionForm>
  )
}
