import { formatDate } from '@/lib/dates'
import { kindInfo, statusInfo, type IdeaSubmission } from '@/lib/ideas'
import { FileThumbs } from './file-thumbs'

// One entry. In the admin view it also shows who sent it and their department.
export function IdeaCard({
  item,
  showPerson = false,
  children,
}: {
  item: IdeaSubmission
  showPerson?: boolean
  children?: React.ReactNode
}) {
  const kind = kindInfo(item.kind)
  const status = statusInfo(item.status)
  return (
    <article className="card space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`tag ${kind.tag}`}>{kind.label}</span>
        <span className="tag tag-cream">{item.area}</span>
        {showPerson && item.person?.department && <span className="tag tag-cream">{item.person.department.name}</span>}
        <span className={`tag ${status.tag}`}>{status.label}</span>
      </div>
      <h3 className="title text-xl leading-tight">{item.title}</h3>
      {item.details && <p className="whitespace-pre-wrap">{item.details}</p>}
      <FileThumbs files={item.files} />
      <p className="text-sm text-grey">
        {showPerson ? `From ${item.person?.name ?? 'someone'} · ` : ''}
        {formatDate(item.created_at.slice(0, 10))}
      </p>
      {children}
    </article>
  )
}
