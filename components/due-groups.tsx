import { dueState } from '@/lib/dates'

// Overdue first, then due today, then upcoming. Items with no date go last.
export function DueGroups<T>({
  items,
  due,
  timeZone,
  render,
}: {
  items: T[]
  due: (item: T) => string | null
  timeZone: string
  render: (item: T) => React.ReactNode
}) {
  const groups = [
    { key: 'overdue', title: 'Overdue', items: items.filter((i) => dueState(due(i), timeZone) === 'overdue') },
    { key: 'today', title: 'Due today', items: items.filter((i) => dueState(due(i), timeZone) === 'today') },
    { key: 'upcoming', title: 'Coming up', items: items.filter((i) => dueState(due(i), timeZone) === 'upcoming') },
    { key: 'none', title: 'No date yet', items: items.filter((i) => dueState(due(i), timeZone) === 'none') },
  ].filter((g) => g.items.length > 0)

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g.key} className="space-y-3">
          <h2 className="label-caps text-xs text-grey">
            {g.title} <span className="text-grey/70">({g.items.length})</span>
          </h2>
          <div className="space-y-3">{g.items.map(render)}</div>
        </section>
      ))}
    </div>
  )
}

export function Section({
  title,
  count,
  tag,
  children,
}: {
  title: string
  count: number
  tag?: React.ReactNode
  children: React.ReactNode
}) {
  if (count === 0) return null
  return (
    <section className="space-y-3">
      <h2 className="label-caps flex flex-wrap items-center gap-2 text-xs text-grey">
        {title} <span className="text-grey/70">({count})</span> {tag}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}
