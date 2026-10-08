import { ActionForm, SubmitButton } from '@/components/action-form'
import type { IdeaDepartment } from '@/lib/ideas'
import { joinIdeaBank, pickIdeaPerson } from '@/app/ideas/actions'

type Person = { id: string; name: string; department: { name: string } | null }

// First visit: a name and a department. On a new phone, tap your name instead.
export function JoinForm({ departments, people }: { departments: IdeaDepartment[]; people: Person[] }) {
  return (
    <div className="space-y-6">
      <section className="card space-y-4">
        <h2 className="label-caps text-xs text-grey">Say hello</h2>
        <ActionForm action={joinIdeaBank} className="space-y-4">
          <div>
            <label className="label" htmlFor="name">
              Your name
            </label>
            <input id="name" name="name" className="field" autoComplete="given-name" maxLength={60} required />
          </div>
          <div>
            <label className="label" htmlFor="department_id">
              Your department
            </label>
            <select id="department_id" name="department_id" className="field" defaultValue="" required>
              <option value="" disabled>
                Pick one
              </option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <SubmitButton pendingText="One moment…">Continue</SubmitButton>
        </ActionForm>
      </section>

      {people.length > 0 && (
        <details className="card">
          <summary className="label-caps cursor-pointer text-xs text-grey">Been here before? Tap your name</summary>
          <div className="mt-4 space-y-3">
            {people.map((p) => (
              <ActionForm key={p.id} action={pickIdeaPerson} className="">
                <input type="hidden" name="person_id" value={p.id} />
                <SubmitButton className="btn-ghost justify-between !px-5" pendingText="One moment…">
                  <span>{p.name}</span>
                  <span className="text-sm font-normal text-grey">{p.department?.name}</span>
                </SubmitButton>
              </ActionForm>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
