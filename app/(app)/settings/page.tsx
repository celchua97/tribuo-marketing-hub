import { requireLead } from '@/lib/data'
import { ROLE_COLOR, ROLE_LABEL } from '@/lib/labels'
import type { Profile, Studio } from '@/lib/types'
import { loadBoard, plateFor } from '@/lib/board'
import { buildNudge } from '@/lib/nudge'
import { MARKET_FLAG } from '@/lib/labels'
import { CopyButton } from '@/components/copy-button'
import { ActionForm, SubmitButton } from '@/components/action-form'
import { PageBand } from '@/components/top-bar'
import { AdminSwitcher } from '@/components/admin-switcher'
import { addStudio, saveSettings, updatePerson } from '../actions'

type Settings = { edit_due_days: number; approval_due_days: number; revision_due_days: number }

export default async function SettingsPage() {
  const { supabase, me } = await requireLead()
  const [{ data: settings }, { data: people }, { data: studios }, board] = await Promise.all([
    supabase.from('settings').select('*').single<Settings>(),
    supabase.from('profiles').select('*').eq('active', true).order('created_at').returns<Profile[]>(),
    supabase.from('studios').select('*').eq('active', true).order('market').order('name').returns<Studio[]>(),
    loadBoard(supabase),
  ])

  const dueFields: { name: keyof Settings; label: string; hint: string }[] = [
    { name: 'edit_due_days', label: 'Edit due', hint: 'days after the shoot' },
    { name: 'approval_due_days', label: 'Approval due', hint: 'days after it’s sent for review' },
    { name: 'revision_due_days', label: 'Revisions due', hint: 'days after you request changes' },
  ]

  return (
    <>
      <PageBand title="Settings" />
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <AdminSwitcher active="board" />

      <section className="card space-y-4">
        <h2 className="label-caps text-xs text-grey">Due dates</h2>
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
                <span className="font-bold">{f.label}</span>{' '}
                <span className="text-grey">{f.hint}</span>
              </span>
            </label>
          ))}
          <SubmitButton>Save due dates</SubmitButton>
        </ActionForm>
      </section>

      <section className="card space-y-4">
        <h2 className="label-caps text-xs text-grey">Team</h2>
        <p className="text-sm text-grey">
          People add themselves from the &ldquo;Who are you?&rdquo; screen. Set a market if someone only
          covers one, for example a Cambodia videographer.
        </p>
        <ul className="divide-y divide-beige">
          {(people ?? []).map((p) => (
            <li key={p.id} className="space-y-2 py-3">
              <p className="flex items-center gap-2 font-bold">
                <span className={`size-3 rounded-full ${ROLE_COLOR[p.role].dot}`} />
                {p.full_name}
                <span className="text-sm font-normal text-grey">{ROLE_LABEL[p.role]}</span>
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
                    <SubmitButton className="chip shrink-0" pendingText="…">
                      Remove
                    </SubmitButton>
                  </ActionForm>
                )}
              </div>
              <CopyButton
                className="chip"
                label={`Copy ${p.full_name.split(' ')[0]}'s nudge`}
                text={buildNudge(p, plateFor(p, board), board.openComments, p.timezone)}
              />
            </li>
          ))}
        </ul>
      </section>

      <section className="card space-y-4">
        <h2 className="label-caps text-xs text-grey">Studios</h2>
        <ul className="divide-y divide-beige">
          {(studios ?? []).map((st) => (
            <li key={st.id} className="flex items-center justify-between py-2.5">
              <span className="font-bold">{st.name}</span>
              <span className="text-sm text-grey">
                {MARKET_FLAG[st.market]} {st.market}
              </span>
            </li>
          ))}
        </ul>
        <ActionForm action={addStudio} className="space-y-3">
          <input name="name" className="field" placeholder="Studio name" required aria-label="Studio name" />
          <select name="market" className="field" defaultValue="MY" aria-label="Market">
            <option value="MY">Malaysia</option>
            <option value="KH">Cambodia</option>
          </select>
          <SubmitButton className="btn-ghost" pendingText="Adding…">
            Add studio
          </SubmitButton>
        </ActionForm>
      </section>
      </main>
    </>
  )
}
