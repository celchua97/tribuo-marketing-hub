import { formatDate } from '@/lib/dates'
import { kindInfo, statusInfo, type IdeaSubmission } from '@/lib/ideas'
import { FileThumbs } from './file-thumbs'

// One entry. Entries are anonymous.
export function IdeaCard({
  item,
  children,
}: {
  item: IdeaSubmission
  children?: React.ReactNode
}) {
  const kind = kindInfo(item.kind)
  const status = statusInfo(item.status)
  return (
    <article className="card space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`tag ${kind.tag}`}>{kind.label}</span>
        <span className="tag tag-cream">{item.area}</span>
        <span className={`tag ${status.tag}`}>{status.label}</span>
      </div>
      <h3 className="title text-xl leading-tight">{item.title}</h3>
      {item.details && <p className="whitespace-pre-wrap">{item.details}</p>}
      <FileThumbs files={item.files} />
      <p className="text-sm text-grey">
        {formatDate(item.created_at.slice(0, 10))}
      </p>
      {children}
    </article>
  )
}
