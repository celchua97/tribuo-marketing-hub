'use client'

import { useOptimistic, useState, useTransition } from 'react'
import { setIdeaStatus } from '@/app/(app)/admin/actions'
import { STATUSES, type Status } from '@/lib/ideas-shared'

// One tap to set where an entry is up to.
export function StatusPicker({ id, status }: { id: string; status: Status }) {
  const [shown, setShown] = useOptimistic(status)
  const [error, setError] = useState('')
  const [, start] = useTransition()

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Status">
        {STATUSES.map((s) => (
          <button
            key={s.value}
            type="button"
            aria-pressed={shown === s.value}
            onClick={() => {
              setError('')
              start(async () => {
                setShown(s.value)
                const res = await setIdeaStatus(id, s.value)
                if (res?.error) setError(res.error)
              })
            }}
            className={`chip min-h-10 text-xs ${shown === s.value ? 'chip-on' : ''}`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {error && <p className="text-sm font-bold text-danger">{error}</p>}
    </div>
  )
}
