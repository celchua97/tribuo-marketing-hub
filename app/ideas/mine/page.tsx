import { getIdeaPerson, loadSubmissions } from '@/lib/ideas'
import { IdeaCard } from '@/components/ideas/idea-card'
import { ActionForm, SubmitButton } from '@/components/action-form'
import { withdrawIdea } from '../actions'

export default async function MySubmissionsPage() {
  const person = await getIdeaPerson()
  if (!person) return null
  const items = await loadSubmissions(person.id)

  if (items.length === 0) {
    return <div className="card text-center text-grey">Nothing yet. What you add shows up here.</div>
  }
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <IdeaCard key={item.id} item={item}>
          {item.status === 'new' && (
            <details className="text-sm">
              <summary className="chip cursor-pointer list-none">Remove</summary>
              <ActionForm action={withdrawIdea} className="mt-3 space-y-3">
                <input type="hidden" name="id" value={item.id} />
                <p className="text-grey">This takes it out for good. You can only do this until we pick it up.</p>
                <SubmitButton className="btn-ghost" pendingText="Removing…">
                  Yes, remove it
                </SubmitButton>
              </ActionForm>
            </details>
          )}
        </IdeaCard>
      ))}
    </div>
  )
}
