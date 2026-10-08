import { STATUS_LABEL, STATUS_PILL, MARKET_FLAG, MARKET_NAME } from '@/lib/labels'
import { dueLabel, dueState } from '@/lib/dates'
import type { Market, VideoStatus } from '@/lib/types'

export function StatusPill({ status }: { status: VideoStatus }) {
  return <span className={`tag ${STATUS_PILL[status]}`}>{STATUS_LABEL[status]}</span>
}

export function MarketFlag({ market }: { market: Market }) {
  return (
    <span title={MARKET_NAME[market]} className="label-caps inline-flex items-center gap-1.5 text-xs text-grey">
      <span className="text-base leading-none">{MARKET_FLAG[market]}</span>
      {market}
    </span>
  )
}

export function DueBadge({ dueOn, timeZone }: { dueOn: string | null; timeZone: string }) {
  if (!dueOn) return null
  const state = dueState(dueOn, timeZone)
  const label = dueLabel(dueOn, timeZone)
  const style = state === 'overdue' ? 'tag-salmon' : state === 'today' ? 'tag-yellow' : 'tag-cream'
  return (
    <span className={`tag ${style}`}>
      {state === 'overdue' && !/overdue/.test(label) ? 'Overdue · ' : ''}
      {label}
    </span>
  )
}
