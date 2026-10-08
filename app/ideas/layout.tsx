import Link from 'next/link'
import { getMe } from '@/lib/data'
import { db } from '@/lib/supabase/admin'
import { getIdeaPerson, loadDepartments } from '@/lib/ideas'
import { PageBand, TopBar } from '@/components/top-bar'
import { PillTabs } from '@/components/pill-tabs'
import { AdminButton } from '@/components/admin-button'
import { JoinForm } from '@/components/ideas/join-form'
import { switchIdeaPerson } from './actions'

export const dynamic = 'force-dynamic'

const WIDTH = 'max-w-[760px]'

export default async function IdeasLayout({ children }: { children: React.ReactNode }) {
  const person = await getIdeaPerson()
  const { me } = await getMe()
  const isAdmin = me?.role === 'lead'

  if (!person) {
    const [departments, { data: people }] = await Promise.all([
      loadDepartments(),
      db()
        .from('idea_people')
        .select('id, name, department:idea_departments(name)')
        .order('name')
        .returns<{ id: string; name: string; department: { name: string } | null }[]>(),
    ])
    return (
      <div className="min-h-dvh pb-16">
        <TopBar label="Idea Bank" width={WIDTH}>
          {isAdmin && <AdminButton />}
        </TopBar>
        <PageBand title="Idea Bank" intro="Pop in your name and department once, and you're in. No password needed." nav={false} />
        <main className={`mx-auto ${WIDTH} px-4 py-6`}>
          <JoinForm departments={departments} people={people ?? []} />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-dvh pb-16">
      <TopBar label="Idea Bank" width={WIDTH}>
        {person.department && <span className="tag tag-cream mr-1">{person.department.name}</span>}
        <span className="mr-1 font-bold text-ink">{person.name}</span>
        <form action={switchIdeaPerson}>
          <button className="rounded-full px-2.5 py-2 hover:bg-white">Switch</button>
        </form>
        <Link href="/" className="rounded-full px-2.5 py-2 hover:bg-white">
          Video board
        </Link>
        {isAdmin && <AdminButton />}
      </TopBar>
      <PageBand
        title="Idea Bank"
        intro="Got an idea, or something we should know? Add it here. We read everything."
        nav={
          <PillTabs
            label="Idea Bank"
            items={[
              { href: '/ideas', label: 'Submit' },
              { href: '/ideas/mine', label: 'Your submissions' },
            ]}
          />
        }
      />
      <main className={`mx-auto ${WIDTH} space-y-6 px-4 py-6`}>{children}</main>
    </div>
  )
}
