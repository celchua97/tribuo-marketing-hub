import { cache } from 'react'
import { cookies } from 'next/headers'
import { db } from './supabase/admin'
import { IDEA_COOKIE } from './session'
import { BUCKET, type IdeaDepartment, type IdeaPerson, type IdeaSubmission } from './ideas-shared'

export * from './ideas-shared'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// The person remembered on this device (name and department), if any.
export const getIdeaPerson = cache(async () => {
  const id = (await cookies()).get(IDEA_COOKIE)?.value
  if (!id || !UUID.test(id)) return null
  const { data } = await db()
    .from('idea_people')
    .select('*, department:idea_departments(name)')
    .eq('id', id)
    .maybeSingle<IdeaPerson>()
  return data
})

export async function loadDepartments(onlyActive = true) {
  let q = db().from('idea_departments').select('*').order('sort_order')
  if (onlyActive) q = q.eq('active', true)
  const { data } = await q.returns<IdeaDepartment[]>()
  return data ?? []
}

const SUBMISSION_SELECT =
  '*, person:idea_people(name, department:idea_departments(name)), files:idea_files(id, path, name, mime, size)'

// Entries with short-lived links for their files. Pass personId to see only one person's.
export async function loadSubmissions(personId?: string): Promise<IdeaSubmission[]> {
  const supabase = db()
  let q = supabase.from('idea_submissions').select(SUBMISSION_SELECT).order('created_at', { ascending: false })
  if (personId) q = q.eq('person_id', personId)
  const { data } = await q.returns<IdeaSubmission[]>()
  const items = data ?? []

  const paths = items.flatMap((i) => i.files.map((f) => f.path))
  if (paths.length) {
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600)
    const byPath = new Map((signed ?? []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl]))
    for (const item of items) {
      for (const f of item.files) {
        const url = byPath.get(f.path)
        if (url) {
          f.url = url
          f.downloadUrl = `${url}${url.includes('?') ? '&' : '?'}download=${encodeURIComponent(f.name)}`
        }
      }
    }
  }
  return items
}

// What the browser needs to upload files straight to storage (the key is the public one).
export function uploadConfig() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  return url && key ? { url, key } : null
}
