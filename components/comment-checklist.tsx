'use client'

import { useOptimistic, useState, useTransition } from 'react'
import { flagComment, toggleComment } from '@/app/(app)/actions'
import type { FeedbackComment } from '@/lib/types'

// Each of Celine's comments is a checkbox. The editor ticks them off, and can
// tap "Need clarification" to flag one back to her.
export function CommentChecklist({
  comments,
  canTick,
}: {
  comments: FeedbackComment[]
  canTick: boolean
}) {
  const [error, setError] = useState('')
  const [pending, start] = useTransition()
  // Show the tick or the flag straight away; the server confirms a moment later.
  const [shown, change] = useOptimistic(
    comments,
    (state, patch: { id: string; resolved_at?: string | null; needs_clarification?: boolean }) =>
      state.map((c) => (c.id === patch.id ? { ...c, ...patch } : c)),
  )

  function run(
    patch: { id: string; resolved_at?: string | null; needs_clarification?: boolean },
    fn: () => Promise<{ error?: string } | undefined>,
  ) {
    setError('')
    start(async () => {
      change(patch)
      const result = await fn()
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {shown.map((c) => {
          const done = !!c.resolved_at
          return (
            <li key={c.id} className="rounded-xl bg-canvas px-3 py-3">
              <div className="flex items-start gap-3">
                <input
                  id={`c-${c.id}`}
                  type="checkbox"
                  checked={done}
                  disabled={!canTick}
                  onChange={(e) =>
                    run({ id: c.id, resolved_at: e.target.checked ? new Date().toISOString() : null }, () =>
                      toggleComment(c.id, e.target.checked),
                    )
                  }
                  className="mt-0.5 size-7 shrink-0 accent-[#3750ab]"
                />
                <label htmlFor={`c-${c.id}`} className={`min-w-0 flex-1 ${done ? 'text-grey line-through' : ''}`}>
                  {c.timecode && <span className="tag tag-blue mr-2 align-middle">{c.timecode}</span>}
                  {c.body}
                </label>
              </div>
              {!done && (c.needs_clarification || canTick) && (
                <div className="mt-2 pl-10">
                  {canTick ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        run({ id: c.id, needs_clarification: !c.needs_clarification }, () =>
                          flagComment(c.id, !c.needs_clarification),
                        )
                      }
                      className={`chip min-h-9 text-xs ${c.needs_clarification ? 'chip-on' : ''}`}
                    >
                      {c.needs_clarification ? 'Asked for clarification' : 'Need clarification'}
                    </button>
                  ) : (
                    <span className="tag tag-yellow">Editor needs clarification</span>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {error && (
        <p role="alert" className="text-sm font-bold text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
