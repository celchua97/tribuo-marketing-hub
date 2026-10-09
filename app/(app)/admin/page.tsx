import { requireLead } from '@/lib/data'
import { formatDate } from '@/lib/dates'
import { AREAS, KINDS, STATUSES, loadDepartments, loadSubmissions, statusInfo, type IdeaPerson } from '@/lib/ideas'
import { PageBand } from '@/components/top-bar'
import { AdminSwitcher } from '@/components/admin-switcher'
import { ActionForm, SubmitButton } from '@/components/action-form'
import { IdeaCard } from '@/components/ideas/idea-card'
import { StatusPicker } from '@/components/ideas/status-picker'
import { FilterForm } from '@/components/ideas/filter-form'
import { ExportCard, type ExportRow } from '@/components/ideas/export-card'
import { envAdminEmails } from '@/lib/admin-auth'
import { addAdminEmail, removeAdminEmail, signOutAdmin } from './access-actions'
import { addDepartment, removeDepartment, renameDepartment, setPersonDepartment } from './actions'

type Search = { section?: string; kind?: string; area?: string; department?: string; status?: string }

export default async function AdminPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams
  const { supabase, adminEmail } = await requireLead('/admin')
  const section = sp.section === 'people' ? 'people' : sp.section === 'access' ? 'access' : 'ideas'

  return (
    <>
      <PageBand title="Admin" nav={false} intro="Everything the team sends in, and who's who." />
      <main className="mx-auto max-w-[760px] space-y-6 px-4 py-6">
        <AdminSwitcher active={section} />
        {section === 'ideas' ? <Ideas sp={sp} /> : section === 'people' ? <People supabase={supabase} /> : <Access supabase={supabase} me={adminEmail} />}
      </main>
    </>
  )
}

async function Ideas({ sp }: { sp: Search }) {
  const [all, departments] = await Promise.all([loadSubmissions(), loadDepartments(false)])
  const items = all.filter(
    (i) =>
      (!sp.kind || i.kind === sp.kind) &&
      (!sp.area || i.area === sp.area) &&
      (!sp.department || i.person?.department?.name === sp.department) &&
      (!sp.status || i.status === sp.status),
  )
  const filtered = !!(sp.kind || sp.area || sp.department || sp.status)
  const noteParts = [
    sp.kind && KINDS.find((k) => k.value === sp.kind)?.label,
    sp.area,
    sp.department,
    sp.status && statusInfo(sp.status).label,
  ].filter(Boolean)

  const rows: ExportRow[] = items.map((i) => ({
    id: i.id,
    created: i.created_at.slice(0, 10),
    name: i.person?.name ?? '',
    department: i.person?.department?.name ?? '',
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
            { name: 'department', label: 'Department', value: sp.department ?? '', options: departments.map((d) => ({ value: d.name, label: d.name })) },
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
            <IdeaCard key={item.id} item={item} showPerson>
              <StatusPicker id={item.id} status={item.status} />
            </IdeaCard>
          ))}
        </div>
      )}
    </>
  )
}

async function People({ supabase }: { supabase: Awaited<ReturnType<typeof requireLead>>['supabase'] }) {
  const [departments, { data: people }, { data: counts }] = await Promise.all([
    loadDepartments(false),
    supabase.from('idea_people').select('*, department:idea_departments(name)').order('created_at', { ascending: false }).returns<IdeaPerson[]>(),
    supabase.from('idea_submissions').select('person_id').returns<{ person_id: string }[]>(),
  ])
  const active = departments.filter((d) => d.active)
  const entries = new Map<string, number>()
  for (const c of counts ?? []) entries.set(c.person_id, (entries.get(c.person_id) ?? 0) + 1)

  return (
    <>
      <section className="card space-y-4">
        <h2 className="label-caps text-xs text-grey">
          Everyone who has joined <span className="text-grey/70">({people?.length ?? 0})</span>
        </h2>
        {(people ?? []).length === 0 ? (
          <p className="text-grey">Nobody yet. People show up here once they add their name.</p>
        ) : (
          <ul className="divide-y divide-beige">
            {(people ?? []).map((p) => (
              <li key={p.id} className="space-y-3 py-4 first:pt-0 last:pb-0">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-bold">{p.name}</p>
                  <p className="text-sm text-grey">
                    Joined {formatDate(p.created_at.slice(0, 10))} · {entries.get(p.id) ?? 0} entr{(entries.get(p.id) ?? 0) === 1 ? 'y' : 'ies'}
                  </p>
                </div>
                <ActionForm action={setPersonDepartment} className="flex items-center gap-2">
                  <input type="hidden" name="person_id" value={p.id} />
                  <select name="department_id" defaultValue={p.department_id ?? ''} className="field py-2" aria-label={`${p.name}'s department`}>
                    {!p.department_id && <option value="">No department</option>}
                    {departments
                      .filter((d) => d.active || d.id === p.department_id)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                  </select>
                  <SubmitButton className="chip shrink-0" pendingText="…">
                    Save
                  </SubmitButton>
                </ActionForm>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card space-y-4">
        <h2 className="label-caps text-xs text-grey">Departments</h2>
        <p className="text-grey">This is the list people pick from when they join. Removing one only hides it from new sign-ups.</p>
        <ul className="space-y-3">
          {active.map((d) => (
            <li key={d.id} className="flex items-center gap-2">
              <ActionForm action={renameDepartment} className="flex min-w-0 flex-1 items-center gap-2">
                <input type="hidden" name="id" value={d.id} />
                <input name="name" defaultValue={d.name} className="field min-w-0 py-2" aria-label={`Rename ${d.name}`} />
                <SubmitButton className="chip shrink-0" pendingText="…">
                  Save
                </SubmitButton>
              </ActionForm>
              <ActionForm action={removeDepartment} className="">
                <input type="hidden" name="id" value={d.id} />
                <SubmitButton className="chip shrink-0" pendingText="…">
                  Remove
                </SubmitButton>
              </ActionForm>
            </li>
          ))}
        </ul>
        <ActionForm action={addDepartment} className="flex items-center gap-2">
          <input name="name" className="field min-w-0 py-2" placeholder="New department" aria-label="New department name" required />
          <SubmitButton className="chip shrink-0" pendingText="…">
            Add
          </SubmitButton>
        </ActionForm>
      </section>
    </>
  )
}

async function Access({ supabase, me }: { supabase: Awaited<ReturnType<typeof requireLead>>['supabase']; me: string }) {
  const { data } = await supabase
    .from('admin_emails')
    .select('email, added_by, created_at')
    .order('created_at')
    .returns<{ email: string; added_by: string | null; created_at: string }[]>()
  const fromVercel = envAdminEmails()
  const rows = [
    ...fromVercel.map((email) => ({ email, note: 'Set in Vercel', removable: false })),
    ...(data ?? [])
      .filter((r) => !fromVercel.includes(r.email))
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
              {r.removable && r.email !== me && (
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
