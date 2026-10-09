import { requireLead } from '@/lib/data'
import { formatDate } from '@/lib/dates'
import { AREAS, KINDS, STATUSES, loadSubmissions, statusInfo } from '@/lib/ideas'
import { headers } from 'next/headers'
import { CopyButton } from '@/components/copy-button'
import { PageBand } from '@/components/top-bar'
import { AdminSwitcher } from '@/components/admin-switcher'
import { ActionForm, SubmitButton } from '@/components/action-form'
import { IdeaCard } from '@/components/ideas/idea-card'
import { StatusPicker } from '@/components/ideas/status-picker'
import { FilterForm } from '@/components/ideas/filter-form'
import { ExportCard, type ExportRow } from '@/components/ideas/export-card'
import { isOwner, ownerEmails } from '@/lib/admin-auth'
import { addAdminEmail, removeAdminEmail, signOutAdmin } from './access-actions'

type Search = { section?: string; kind?: string; area?: string; status?: string }

export default async function AdminPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams
  const { supabase, adminEmail } = await requireLead('/admin')
  const section = sp.section === 'access' ? 'access' : 'ideas'

  return (
    <>
      <PageBand title="Admin" nav={false} intro="Everything people send to the Idea Bank, and who can open this side." />
      <main className="mx-auto max-w-[760px] space-y-6 px-4 py-6">
        <AdminSwitcher active={section} />
        {section === 'ideas' ? <Ideas sp={sp} /> : <Access supabase={supabase} me={adminEmail} />}
      </main>
    </>
  )
}

async function Ideas({ sp }: { sp: Search }) {
  const all = await loadSubmissions()
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? ''
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  const link = `${proto}://${host}/ideas`
  const items = all.filter(
    (i) =>
      (!sp.kind || i.kind === sp.kind) &&
      (!sp.area || i.area === sp.area) &&
      (!sp.status || i.status === sp.status),
  )
  const filtered = !!(sp.kind || sp.area || sp.status)
  const noteParts = [
    sp.kind && KINDS.find((k) => k.value === sp.kind)?.label,
    sp.area,
    sp.status && statusInfo(sp.status).label,
  ].filter(Boolean)

  const rows: ExportRow[] = items.map((i) => ({
    id: i.id,
    created: i.created_at.slice(0, 10),
    kind: i.kind,
    area: i.area,
    status: statusInfo(i.status).label,
    title: i.title,
    details: i.details ?? '',
    files: i.files.map((f) => f.name),
  }))

  const tiles = [
    { label: 'All entries', n: all.length },
    ...STATUSES.map((s) => ({ label: s.label, n: all.filter((i) => i.status === s.value).length })),
  ]

  return (
    <>
      <section className="card space-y-3">
        <h2 className="label-caps text-xs text-grey">Public link</h2>
        <p className="text-grey">Share this with anyone. No name or sign in is needed to send an idea.</p>
        <p className="break-all font-bold">{link}</p>
        <CopyButton text={link} label="Copy link" className="chip" />
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {tiles.map((t, i) => (
          <div key={t.label} className={`card !p-4 ${i === 0 ? 'col-span-2 sm:col-span-1' : ''}`}>
            <p className="title text-4xl">{t.n}</p>
            <p className="label-caps mt-1 text-[11px] text-grey">{t.label}</p>
          </div>
        ))}
      </section>

      <section className="card space-y-4">
        <h2 className="label-caps text-xs text-grey">Filter</h2>
        <FilterForm
          hidden={{ section: 'ideas' }}
          fields={[
            { name: 'kind', label: 'Type', value: sp.kind ?? '', options: KINDS.map((k) => ({ value: k.value, label: k.label })) },
            { name: 'area', label: 'Area', value: sp.area ?? '', options: AREAS.map((a) => ({ value: a, label: a })) },
            { name: 'status', label: 'Status', value: sp.status ?? '', options: STATUSES.map((s) => ({ value: s.value, label: s.label })) },
          ]}
        />
        {filtered && (
          <a href="/admin" className="inline-block text-sm font-bold text-blue">
            Clear filters
          </a>
        )}
      </section>

      <ExportCard rows={rows} note={noteParts.join(', ')} />

      {items.length === 0 ? (
        <div className="card text-center text-grey">
          {all.length === 0 ? 'Nothing yet. What the team adds shows up here.' : 'Nothing matches those filters.'}
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <IdeaCard key={item.id} item={item}>
              <StatusPicker id={item.id} status={item.status} />
            </IdeaCard>
          ))}
        </div>
      )}
    </>
  )
}

async function Access({ supabase, me }: { supabase: Awaited<ReturnType<typeof requireLead>>['supabase']; me: string }) {
  const { data } = await supabase
    .from('admin_emails')
    .select('email, added_by, created_at')
    .order('created_at')
    .returns<{ email: string; added_by: string | null; created_at: string }[]>()
  const owners = ownerEmails()
  const iAmOwner = isOwner(me)
  const rows = [
    ...owners.map((email) => ({ email, note: 'Owner. Can give and take away access.', removable: false })),
    ...(data ?? [])
      .filter((r) => !owners.includes(r.email))
      .map((r) => ({ email: r.email, note: `Added ${formatDate(r.created_at.slice(0, 10))}${r.added_by ? ` by ${r.added_by}` : ''}`, removable: true })),
  ]
  return (
    <>
      <section className="card space-y-4">
        <h2 className="label-caps text-xs text-grey">Who can open the admin side</h2>
        <p className="text-grey">
          These emails can sign in with a code. Everyone else can use the Hub, the to-dos and the Idea Bank, but not
          this side.
        </p>
        <ul className="divide-y divide-beige">
          {rows.map((r) => (
            <li key={r.email} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate font-bold">
                  {r.email}
                  {r.email === me && <span className="ml-2 text-sm font-normal text-grey">(you)</span>}
                </p>
                <p className="text-sm text-grey">{r.note}</p>
              </div>
              {iAmOwner && r.removable && r.email !== me && (
                <ActionForm action={removeAdminEmail} className="">
                  <input type="hidden" name="email" value={r.email} />
                  <SubmitButton className="chip shrink-0" pendingText="…">
                    Remove
                  </SubmitButton>
                </ActionForm>
              )}
            </li>
          ))}
          {rows.length === 0 && <li className="py-2 text-grey">Nobody yet.</li>}
        </ul>
      </section>

      {iAmOwner ? (
      <section className="card space-y-3">
        <h2 className="label-caps text-xs text-grey">Give someone access</h2>
        <ActionForm action={addAdminEmail} className="flex items-center gap-2">
          <input name="email" type="email" className="field min-w-0 py-2" placeholder="their@email.com" aria-label="Email to give access" required />
          <SubmitButton className="chip shrink-0" pendingText="…">
            Add
          </SubmitButton>
        </ActionForm>
        <p className="text-sm text-grey">They go to the admin page, type this email, and get a code by email. Nothing else to set up.</p>
      </section>

      ) : (
        <p className="px-1 text-sm text-grey">Only the owner can give or take away access.</p>
      )}

      <section className="card space-y-3">
        <p className="text-grey">
          Signed in as <strong className="text-ink">{me}</strong>.
        </p>
        <ActionForm action={signOutAdmin} className="">
          <SubmitButton className="chip" pendingText="…">
            Sign out of admin
          </SubmitButton>
        </ActionForm>
      </section>
    </>
  )
}
