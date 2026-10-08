import Link from 'next/link'
import { requireLead } from '@/lib/data'
import { ROLE_COLOR, ROLE_LABEL } from '@/lib/labels'
import type { Profile } from '@/lib/types'
import { ActionForm, SubmitButton } from '@/components/action-form'
import { saveSettings, updatePerson } from '../actions'

type Settings = { edit_due_days: number; approval_due_days: number; revision_due_days: number }

export default async function SettingsPage() {
  const { supabase, me } = await requireLead()
  const [{ data: settings }, { data: people }] = await Promise.all([
    supabase.from('settings').select('*').single<Settings>(),
    supabase.from('profiles').select('*').eq('active', true).order('created_at').returns<Profile[]>(),
  ])

  const dueFields: { name: keyof Settings; label: string; hint: string }[] = [
    { name: 'edit_due_days', label: 'Edit due', hint: 'days after the shoot' },
    { name: 'approval_due_days', label: 'Approval due', hint: 'days after it’s sent for review' },
    { name: 'revision_due_days', label: 'Revisions due', hint: 'days after you request changes' },
  ]

  return (
    <main className="space-y-6">
      <div>
        <Link href="/" className="text-sm text-ink/60">
          ‹ Back
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Settings</h1>
      </div>

      <section className="card space-y-4">
        <h2 className="font-semibold">Due dates</h2>
        <ActionForm action={saveSettings} className="space-y-4">
          {dueFields.map((f) => (
            <label key={f.name} className="flex items-center gap-3">
              <input
                name={f.name}
                type="number"
                min={0}
                max={30}
                required
                defaultValue={settings?.[f.name]}
                className="field w-20 text-center"
              />
              <span>
                <span className="font-medium">{f.label}</span>{' '}
                <span className="text-ink/60">{f.hint}</span>
              </span>
            </label>
          ))}
          <SubmitButton>Save due dates</SubmitButton>
        </ActionForm>
      </section>

      <section className="card space-y-4">
        <h2 className="font-semibold">Team</h2>
        <p className="text-sm text-ink/60">
          People add themselves from the &ldquo;Who are you?&rdquo; screen. Set a market if someone only
          covers one, for example a Cambodia videographer.
        </p>
        <ul className="divide-y divide-ink/5">
          {(people ?? []).map((p) => (
            <li key={p.id} className="space-y-2 py-3">
              <p className="flex items-center gap-2 font-medium">
                <span className={`size-3 rounded-full ${ROLE_COLOR[p.role].dot}`} />
                {p.full_name}
                <span className="text-sm font-normal text-ink/50">{ROLE_LABEL[p.role]}</span>
              </p>
              <div className="flex items-center gap-2">
                <ActionForm action={updatePerson} className="flex flex-1 items-center gap-2">
                  <input type="hidden" name="person_id" value={p.id} />
                  <select name="market" defaultValue={p.market ?? ''} className="field py-2" aria-label={`${p.full_name} covers`}>
                    <option value="">Both markets</option>
                    <option value="MY">Malaysia only</option>
                    <option value="KH">Cambodia only</option>
                  </select>
                  <SubmitButton className="chip shrink-0" pendingText="…">
                    Save
                  </SubmitButton>
                </ActionForm>
                {p.id !== me.id && (
                  <ActionForm action={updatePerson} className="">
                    <input type="hidden" name="person_id" value={p.id} />
                    <input type="hidden" name="market" value={p.market ?? ''} />
                    <input type="hidden" name="active" value="false" />
                    <SubmitButton className="chip shrink-0 text-red-700" pendingText="…">
                      Remove
                    </SubmitButton>
                  </ActionForm>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
