'use client'

import { useState } from 'react'
import { saveVideo } from '@/app/(app)/actions'
import type { BriefTemplate, Market, Pillar, Video } from '@/lib/types'
import { MARKET_FLAG, MARKET_NAME } from '@/lib/labels'
import { ActionForm, SubmitButton } from './action-form'

export function VideoForm({
  video,
  pillars,
  templates,
  nextEpisode,
}: {
  video?: Video
  pillars: Pillar[]
  templates: BriefTemplate[]
  nextEpisode: Record<Market, number>
}) {
  const [market, setMarket] = useState<Market>(video?.market ?? 'MY')
  const [pillarId, setPillarId] = useState(video?.pillar_id ?? '')
  const [brief, setBrief] = useState(video?.brief ?? '')
  const [episode, setEpisode] = useState(video?.episode_number?.toString() ?? '')
  const [templateId, setTemplateId] = useState('')

  function applyTemplate(t: BriefTemplate) {
    if (brief.trim() && brief !== templates.find((x) => x.id === templateId)?.brief) {
      if (!confirm('Replace the brief you’ve written with this template?')) return
    }
    setTemplateId(t.id)
    setBrief(t.brief)
    if (t.pillar_id) setPillarId(t.pillar_id)
  }

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

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="pillar_id">
            Content pillar
          </label>
          <select
            id="pillar_id"
            name="pillar_id"
            className="field"
            value={pillarId}
            onChange={(e) => setPillarId(e.target.value)}
          >
            <option value="">None</option>
            {pillars.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
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
      </div>

      <div>
        <span className="label">Start from a template</span>
        <div className="flex flex-wrap gap-2">
          {templates.map((t) => (
            <button
              type="button"
              key={t.id}
              onClick={() => applyTemplate(t)}
              className={`chip ${templateId === t.id ? 'chip-on' : ''}`}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="brief">
          Brief
        </label>
        <textarea
          id="brief"
          name="brief"
          rows={7}
          className="field"
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="Leave empty to save as an idea. It goes to the videographer once there’s a brief."
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="target_post_date">
            Target post date
          </label>
          <input
            id="target_post_date"
            name="target_post_date"
            type="date"
            className="field"
            defaultValue={video?.target_post_date ?? ''}
          />
        </div>
        <div>
          <label className="label" htmlFor="reference_link">
            Reference link (optional)
          </label>
          <input
            id="reference_link"
            name="reference_link"
            type="url"
            inputMode="url"
            className="field"
            defaultValue={video?.reference_link ?? ''}
          />
        </div>
      </div>

      <SubmitButton>{video ? 'Save changes' : brief.trim() ? 'Save and send to shoot' : 'Save idea'}</SubmitButton>
    </ActionForm>
  )
}
