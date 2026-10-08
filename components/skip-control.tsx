'use client'

import { useState } from 'react'
import { markShot, skipShot } from '@/app/(app)/actions'
import { SKIP_REASONS } from '@/lib/labels'
import { ActionForm, SubmitButton } from './action-form'

// Two big buttons per shot. "Skipped" opens the preset reasons.
export function ShotButtons({ videoId }: { videoId: string }) {
  const [skipping, setSkipping] = useState(false)

  if (skipping) {
    return (
      <ActionForm action={skipShot} className="space-y-3">
        <input type="hidden" name="video_id" value={videoId} />
        <p className="label-caps text-xs text-grey">Why was it skipped?</p>
        <div className="flex flex-wrap gap-2">
          {SKIP_REASONS.map((r) => (
            <SubmitButton key={r} name="reason" value={r} className="chip" pendingText="…">
              {r}
            </SubmitButton>
          ))}
        </div>
        <button type="button" onClick={() => setSkipping(false)} className="text-sm font-bold text-grey">
          Cancel
        </button>
      </ActionForm>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <ActionForm action={markShot} className="">
        <input type="hidden" name="video_id" value={videoId} />
        <SubmitButton pendingText="Saving…">Shot</SubmitButton>
      </ActionForm>
      <button type="button" className="btn-ghost" onClick={() => setSkipping(true)}>
        Skipped
      </button>
    </div>
  )
}
