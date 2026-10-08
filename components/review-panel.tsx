'use client'

import { useState } from 'react'
import { approveVideo } from '@/app/(app)/actions'
import { ActionForm, SubmitButton } from './action-form'
import { RequestChangesForm } from './request-changes-form'

export function ReviewPanel({ videoId }: { videoId: string }) {
  const [requesting, setRequesting] = useState(false)
  if (requesting) return <RequestChangesForm videoId={videoId} onCancel={() => setRequesting(false)} />
  return (
    <div className="grid grid-cols-2 gap-3">
      <button type="button" className="btn-ghost" onClick={() => setRequesting(true)}>
        Request changes
      </button>
      <ActionForm action={approveVideo} className="">
        <input type="hidden" name="video_id" value={videoId} />
        <SubmitButton pendingText="Approving…">Approve</SubmitButton>
      </ActionForm>
    </div>
  )
}
