import { requireMe } from '@/lib/data'
import { loadTodos } from '@/lib/todos'
import { PageBand } from '@/components/top-bar'
import { SlidesImport } from '@/components/videos/slides-import'
import { TodoBoard } from '@/components/todos/todo-board'

// Reading a big deck from Google can take a few seconds
export const maxDuration = 60

export default async function TodosPage() {
  const { supabase, me } = await requireMe()
  const { sections, items } = await loadTodos(supabase)
  const isLead = me.role === 'lead'
  return (
    <>
      <PageBand
        title="To-do board"
        intro="To-dos by section. Tick them off, and drag them wherever they belong."
        nav={false}
      />
      <main className="mx-auto max-w-[760px] space-y-4 px-4 py-6">
        {isLead && (
          <details className="card">
            <summary className="label-caps cursor-pointer text-xs text-grey">Add to-dos from Google Slides</summary>
            <div className="mt-4">
              <SlidesImport sections={sections} defaultDestination="todos" bare />
            </div>
          </details>
        )}
        <TodoBoard sections={sections} items={items} isLead={isLead} />
      </main>
    </>
  )
}
