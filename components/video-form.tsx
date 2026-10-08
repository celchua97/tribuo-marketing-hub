'use client'

import { useState } from 'react'
import { saveVideo } from '@/app/(app)/actions'
import type { Market, Video } from '@/lib/types'
import { MARKET_FLAG, MARKET_NAME } from '@/lib/labels'
import { ActionForm, SubmitButton } from './action-form'

export function VideoForm({
  video,
  nextEpisode,
}: {
  video?: Video
  nextEpisode: Record<Market, number>
}) {
  const [market, setMarket] = useState<Market>(video?.market ?? 'MY')
  const [episode, setEpisode] = useState(video?.episode_number?.toString() ?? '')

  return (
    <ActionForm action={saveVideo} className="space-y-5">
      {video && <input type="hidden" name="id" value={video.id} />}

      <div>
        <label className="label" htmlFor="title">
          Title
        </label>
        <input id="title" name="title" className="field" required defaultValue={video?.title} />
      </div>

      <div>
        <span className="label">Market</span>
        <input type="hidden" name="market" value={market} />
        <div className="flex gap-2">
          {(['MY', 'KH'] as Market[]).map((m) => (
            <button
              type="button"
              key={m}
              onClick={() => setMarket(m)}
              className={`chip flex-1 justify-center ${market === m ? 'chip-on' : ''}`}
            >
              {MARKET_FLAG[m]} {MARKET_NAME[m]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="episode_number">
          Episode (optional)
        </label>
        <div className="flex gap-2">
          <input
            id="episode_number"
            name="episode_number"
            className="field min-w-0"
            inputMode="numeric"
            value={episode}
            onChange={(e) => setEpisode(e.target.value.replace(/\D/g, ''))}
          />
          {!episode && (
            <button
              type="button"
              className="chip shrink-0"
              onClick={() => setEpisode(String(nextEpisode[market]))}
            >
              #{nextEpisode[market]}
            </button>
          )}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="reference_link">
          Google Slides link (optional)
        </label>
        <input
          id="reference_link"
          name="reference_link"
          type="url"
          inputMode="url"
          className="field"
          placeholder="https://docs.google.com/presentation/…"
          defaultValue={video?.reference_link ?? ''}
        />
      </div>

      <SubmitButton>{video ? 'Save changes' : 'Save video'}</SubmitButton>
    </ActionForm>
  )
}
