import Link from 'next/link'
import { requireLead } from '@/lib/data'
import { MARKET_FLAG, ROLE_LABEL } from '@/lib/labels'
import type { Market, Profile, Role } from '@/lib/types'
import { ActionForm, SubmitButton } from '@/components/action-form'
import { inviteMember, removeInvite, saveSettings } from '../actions'

type Settings = { edit_due_days: number; approval_due_days: number; revision_due_days: number }
type Invite = { email: string; full_name: string; role: Role; market: Market | null }

export default async function SettingsPage() {
  const { supabase } = await requireLead()
  const [{ data: settings }, { data: people }, { data: invites }] = await Promise.all([
    supabase.from('settings').select('*').single<Settings>(),
    supabase.from('profiles').select('*').order('created_at').returns<Profile[]>(),
    supabase.from('team_invites').select('*').order('created_at').returns<Invite[]>(),
  ])
  const joined = new Set((people ?? []).map((p) => p.email))
  const pending = (invites ?? []).filter((i) => !joined.has(i.email))

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
        <ul className="divide-y divide-ink/5">
          {(people ?? []).map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2">
              <span>
                <span className="font-medium">{p.full_name}</span>{' '}
                <span className="text-sm text-ink/50">{p.email}</span>
              </span>
              <span className="text-sm text-ink/60">
                {ROLE_LABEL[p.role]} {p.market && MARKET_FLAG[p.market]}
              </span>
            </li>
          ))}
          {pending.map((i) => (
            <li key={i.email} className="flex items-center justify-between gap-3 py-2">
              <span>
                <span className="font-medium">{i.full_name}</span>{' '}
                <span className="text-sm text-ink/50">{i.email} · invited, not signed in yet</span>
              </span>
              <ActionForm action={removeInvite} className="">
                <input type="hidden" name="email" value={i.email} />
                <SubmitButton className="text-sm text-red-700" pendingText="…">
                  Remove
                </SubmitButton>
              </ActionForm>
            </li>
          ))}
        </ul>

        <details>
          <summary className="cursor-pointer text-sm font-semibold text-blue">+ Add someone</summary>
          <ActionForm action={inviteMember} className="mt-3 space-y-3">
            <input name="full_name" className="field" placeholder="Name" required />
            <input name="email" type="email" className="field" placeholder="Email" required />
            <div className="grid grid-cols-2 gap-3">
              <select name="role" className="field" defaultValue="videographer">
                <option value="videographer">Videographer</option>
                <option value="editor">Editor</option>
                <option value="lead">Head of Marketing</option>
              </select>
              <select name="market" className="field" defaultValue="">
                <option value="">Both markets</option>
                <option value="MY">Malaysia only</option>
                <option value="KH">Cambodia only</option>
              </select>
            </div>
            <p className="text-sm text-ink/60">
              They can then sign in with this email. No password needed.
            </p>
            <SubmitButton>Add to team</SubmitButton>
          </ActionForm>
        </details>
      </section>
    </main>
  )
}
