import { db } from '@/lib/supabase/admin'
import { ROLE_COLOR, ROLE_LABEL } from '@/lib/labels'
import type { Profile } from '@/lib/types'
import { ActionForm, SubmitButton } from '@/components/action-form'
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
    <main className="mx-auto min-h-dvh max-w-md space-y-8 px-4 py-10">
      <div>
        <p className="text-sm font-semibold tracking-wide text-blue uppercase">Tribuo content</p>
        <h1 className="mt-1 text-3xl font-bold">Who are you?</h1>
      </div>

      {people.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-ink/60">Tap your name</h2>
          <div className="space-y-3">
            {people.map((p) => (
              <ActionForm key={p.id} action={pickPerson} className="">
                <input type="hidden" name="person_id" value={p.id} />
                <SubmitButton className="btn-ghost justify-start" pendingText="One moment…">
                  <span className={`size-5 shrink-0 rounded-full ${ROLE_COLOR[p.role].dot}`} />
                  <span>{p.full_name}</span>
                  <span className="ml-auto text-sm font-normal text-ink/50">{ROLE_LABEL[p.role]}</span>
                </SubmitButton>
              </ActionForm>
            ))}
          </div>
        </section>
      )}

      <section className="card space-y-4">
        <h2 className="font-semibold">{people.length > 0 ? 'New here?' : 'Set up your name'}</h2>
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
                  <span className="flex min-h-14 items-center gap-3 rounded-xl border border-ink/10 bg-white px-4 peer-checked:border-ink peer-checked:ring-2 peer-checked:ring-ink/20 peer-focus-visible:ring-2 peer-focus-visible:ring-blue">
                    <span className={`size-6 shrink-0 rounded-full ${ROLE_COLOR[r].dot}`} />
                    <span className="font-semibold">{ROLE_LABEL[r]}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <SubmitButton pendingText="One moment…">Continue</SubmitButton>
        </ActionForm>
      </section>
    </main>
  )
}
