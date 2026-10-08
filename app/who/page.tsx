import { db } from '@/lib/supabase/admin'
import { ROLE_COLOR, ROLE_LABEL } from '@/lib/labels'
import type { Profile } from '@/lib/types'
import { ActionForm, SubmitButton } from '@/components/action-form'
import { PageBand, TopBar } from '@/components/top-bar'
import { joinTeam, pickPerson } from './actions'

export const dynamic = 'force-dynamic'

export default async function WhoPage() {
  const { data } = await db()
    .from('profiles')
    .select('id, full_name, role')
    .eq('active', true)
    .order('created_at')
    .returns<Pick<Profile, 'id' | 'full_name' | 'role'>[]>()
  const people = data ?? []
  const leadTaken = people.some((p) => p.role === 'lead')
  const colours = (['lead', 'videographer', 'editor'] as const).filter((r) => !(r === 'lead' && leadTaken))

  return (
    <div className="min-h-dvh pb-16">
      <TopBar />
      <PageBand title="Who are you?" />
      <main className="mx-auto max-w-md space-y-8 px-4 py-6">
      {people.length > 0 && (
        <section className="space-y-3">
          <h2 className="label-caps text-xs text-grey">Tap your name</h2>
          <div className="space-y-3">
            {people.map((p) => (
              <ActionForm key={p.id} action={pickPerson} className="">
                <input type="hidden" name="person_id" value={p.id} />
                <SubmitButton className="btn-ghost justify-start !px-5" pendingText="One moment…">
                  <span className={`size-5 shrink-0 rounded-full ${ROLE_COLOR[p.role].dot}`} />
                  <span>{p.full_name}</span>
                  <span className="ml-auto text-sm font-normal text-grey">{ROLE_LABEL[p.role]}</span>
                </SubmitButton>
              </ActionForm>
            ))}
          </div>
        </section>
      )}

      <section className="card space-y-4">
        <h2 className="label-caps text-xs text-grey">{people.length > 0 ? 'New here?' : 'Set up your name'}</h2>
        <ActionForm action={joinTeam} className="space-y-4">
          <div>
            <label className="label" htmlFor="name">
              Your name
            </label>
            <input id="name" name="name" className="field" autoComplete="given-name" maxLength={60} required />
          </div>
          <div>
            <span className="label">Pick your colour</span>
            <div className="space-y-2">
              {colours.map((r, i) => (
                <label key={r} className="block cursor-pointer">
                  <input type="radio" name="role" value={r} required defaultChecked={i === 0 && colours.length === 1} className="peer sr-only" />
                  <span className="flex min-h-14 items-center gap-3 rounded-full border-2 border-beige bg-transparent px-5 peer-checked:border-ink peer-focus-visible:ring-2 peer-focus-visible:ring-blue">
                    <span className={`size-6 shrink-0 rounded-full ${ROLE_COLOR[r].dot}`} />
                    <span className="font-bold">{ROLE_LABEL[r]}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <SubmitButton pendingText="One moment…">Continue</SubmitButton>
        </ActionForm>
      </section>
      </main>
    </div>
  )
}
