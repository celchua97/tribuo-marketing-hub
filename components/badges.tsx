import { STATUS_LABEL, STATUS_PILL, MARKET_FLAG, MARKET_NAME } from '@/lib/labels'
import { dueLabel, dueState } from '@/lib/dates'
import type { Market, VideoStatus } from '@/lib/types'

export function StatusPill({ status }: { status: VideoStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_PILL[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  )
}

export function MarketFlag({ market }: { market: Market }) {
  return (
    <span title={MARKET_NAME[market]} className="inline-flex items-center gap-1 text-xs font-semibold text-ink/60">
      <span className="text-base leading-none">{MARKET_FLAG[market]}</span>
      {market}
    </span>
  )
}

export function DueBadge({ dueOn, timeZone }: { dueOn: string | null; timeZone: string }) {
  if (!dueOn) return null
  const state = dueState(dueOn, timeZone)
  const style =
    state === 'overdue'
      ? 'bg-red-600 text-white'
      : state === 'today'
        ? 'bg-coral text-ink'
        : 'bg-ink/5 text-ink/70'
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}>
      {state === 'overdue' ? 'Overdue · ' : ''}
      {dueLabel(dueOn, timeZone)}
    </span>
  )
}
