import Link from 'next/link'
import { getMe } from '@/lib/data'
import { getIdeaPerson } from '@/lib/ideas'
import { loadBoard, plateFor } from '@/lib/board'
import { dueState } from '@/lib/dates'
import { db } from '@/lib/supabase/admin'
import type { Profile } from '@/lib/types'
import { AdminButton } from '@/components/admin-button'
import { PageBand, TopBar } from '@/components/top-bar'
import { ROLE_LABEL } from '@/lib/labels'

export const dynamic = 'force-dynamic'

type Tag = { text: string; tone: 'yellow' | 'salmon' | 'cream' | 'blue' }
const TONE = { yellow: 'tag-yellow', salmon: 'tag-salmon', cream: 'tag-cream', blue: 'tag-blue' }

function boardTags(me: Profile, board: Awaited<ReturnType<typeof loadBoard>>): Tag[] {
  const plate = plateFor(me, board)
  const tz = me.timezone
  const tags: Tag[] = []
  if (plate.role === 'lead') {
    if (plate.approvals.length) tags.push({ text: `${plate.approvals.length} waiting for your approval`, tone: 'yellow' })
    if (plate.followUps.length) tags.push({ text: `${plate.followUps.length} to follow up`, tone: 'salmon' })
    if (plate.unscheduled.length) tags.push({ text: `${plate.unscheduled.length} unscheduled`, tone: 'salmon' })
  } else if (plate.role === 'videographer') {
    const shots = Object.values(plate.shots).reduce((n, s) => n + s.length, 0)
    const late = plate.days.filter((d) => dueState(d.shoot_date, tz) === 'overdue').length
    if (shots) tags.push({ text: `${shots} shot${shots === 1 ? '' : 's'} to do`, tone: 'yellow' })
    if (late) tags.push({ text: `${late} shoot day${late === 1 ? '' : 's'} overdue`, tone: 'salmon' })
  } else {
    const late = plate.tasks.filter((v) => dueState(v.due_on, tz) === 'overdue').length
    if (plate.tasks.length) tags.push({ text: `${plate.tasks.length} to edit`, tone: 'yellow' })
    if (late) tags.push({ text: `${late} overdue`, tone: 'salmon' })
  }
  return tags.length ? tags : [{ text: 'All clear', tone: 'cream' }]
}

function ToolCard({ href, title, blurb, tags }: { href: string; title: string; blurb: string; tags: Tag[] }) {
  return (
    <Link href={href} className="card block space-y-3 transition active:scale-[0.99]">
      <div className="flex items-start justify-between gap-3">
        <h2 className="title text-2xl leading-tight">{title}</h2>
        <span aria-hidden className="mt-1 text-xl text-grey">
          ›
        </span>
      </div>
      <p className="text-grey">{blurb}</p>
      <div className="flex flex-wrap gap-2">
        {tags.map((t) => (
          <span key={t.text} className={`tag ${TONE[t.tone]}`}>
            {t.text}
          </span>
        ))}
      </div>
    </Link>
  )
}

export default async function HubHome() {
  const { supabase, me } = await getMe()
  const ideaPerson = await getIdeaPerson()
  const isAdmin = me?.role === 'lead'

  const [board, mine, newIdeas] = await Promise.all([
    me ? loadBoard(supabase) : null,
    ideaPerson
      ? supabase.from('idea_submissions').select('id', { count: 'exact', head: true }).eq('person_id', ideaPerson.id)
      : null,
    isAdmin
      ? db().from('idea_submissions').select('id', { count: 'exact', head: true }).eq('status', 'new')
      : null,
  ])

  const boardTagList: Tag[] = me && board ? boardTags(me, board) : [{ text: 'Pick your name to start', tone: 'cream' }]
  const ideaTags: Tag[] = ideaPerson
    ? [{ text: `${mine?.count ?? 0} from you`, tone: 'cream' }]
    : [{ text: 'Add your name to start', tone: 'cream' }]

  return (
    <div className="min-h-dvh pb-16">
      <TopBar
        label="Hub"
        width="max-w-[760px]"
        menu={{ isAdmin, who: me ? `${me.full_name}, ${ROLE_LABEL[me.role]}` : ideaPerson?.name }}
      >
        {isAdmin && <AdminButton />}
      </TopBar>
      <PageBand title="Tribuo Hub" intro="Your marketing tools in one place. Pick one to get going." nav={false} />
      <main className="mx-auto max-w-[760px] space-y-4 px-4 py-6">
        <ToolCard
          href="/board"
          title="Marketing content workflow progress board"
          blurb="See what has been shot, edited and approved, and who needs a nudge."
          tags={boardTagList}
        />
        <ToolCard
          href="/ideas"
          title="Idea Bank"
          blurb="Got an idea, or something we should know? Add it here."
          tags={ideaTags}
        />
        {isAdmin && (
          <ToolCard
            href="/admin"
            title="Admin"
            blurb="Everything the team sends in, who has joined, and the board settings."
            tags={[{ text: `${newIdeas?.count ?? 0} new idea${newIdeas?.count === 1 ? '' : 's'}`, tone: 'blue' }]}
          />
        )}
        <p className="px-1 text-center text-sm text-grey">
          Tip: on a phone, swipe right or tap the menu button. On a laptop, move your mouse to the left edge.
        </p>
      </main>
    </div>
  )
}
