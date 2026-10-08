'use client'

import { useState } from 'react'
import { approveVideo } from '@/app/(app)/actions'
import { ActionForm, SubmitButton } from './action-form'
import { RequestChangesForm } from './request-changes-form'

export function ReviewPanel({ videoId }: { videoId: string }) {
  const [requesting, setRequesting] = useState(false)
  if (requesting) return <RequestChangesForm videoId={videoId} onCancel={() => setRequesting(false)} />
  return (
    <div className="flex flex-col gap-3">
      <ActionForm action={approveVideo} className="">
        <input type="hidden" name="video_id" value={videoId} />
        <SubmitButton pendingText="Approving…">Approve</SubmitButton>
      </ActionForm>
      <button type="button" className="btn-ghost" onClick={() => setRequesting(true)}>
        Request changes
      </button>
    </div>
  )
}
