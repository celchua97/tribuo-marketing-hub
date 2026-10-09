import Link from 'next/link'
import { requireMe } from '@/lib/data'
import { getAdminEmail } from '@/lib/admin-auth'
import { loadTodos } from '@/lib/todos'
import { PageBand } from '@/components/top-bar'
import { SlidesImport } from '@/components/videos/slides-import'
import { TodoBoard } from '@/components/todos/todo-board'

// Reading a big deck from Google can take a few seconds
export const maxDuration = 60

export default async function TodosPage() {
  const { supabase, me } = await requireMe()
  const { sections, items } = await loadTodos(supabase)
  const isLead = me.role === 'lead' && !!(await getAdminEmail())
  const { data: people } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('active', true)
    .order('full_name')
    .returns<{ id: string; full_name: string }[]>()
  return (
    <>
      <PageBand
        title="To-dos"
        intro="Lists of what needs doing. Tick them off, and drag them wherever they belong."
        nav={false}
      />
      <main className="mx-auto max-w-[980px] space-y-4 px-4 py-6">
        {me.role === 'lead' && !isLead && (
          <p className="text-sm text-grey">
            To add or change lists, <Link href="/login?next=/todos" className="font-bold text-blue underline">sign in as admin</Link>.
          </p>
        )}
        {isLead && (
          <details className="card">
            <summary className="label-caps cursor-pointer text-xs text-grey">Add to-dos from Google Slides</summary>
            <div className="mt-4">
              <SlidesImport sections={sections} defaultDestination="todos" bare />
            </div>
          </details>
        )}
        <TodoBoard sections={sections} items={items} people={people ?? []} timeZone={me.timezone} isLead={isLead} />
      </main>
    </>
  )
}
