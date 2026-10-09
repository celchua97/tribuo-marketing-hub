import { db } from './supabase/admin'
import { BUCKET, type IdeaSubmission } from './ideas-shared'

export * from './ideas-shared'

const SUBMISSION_SELECT = '*, files:idea_files(id, path, name, mime, size)'

// Every entry, newest first, with short-lived links for their files.
export async function loadSubmissions(): Promise<IdeaSubmission[]> {
  const supabase = db()
  const { data } = await supabase
    .from('idea_submissions')
    .select(SUBMISSION_SELECT)
    .order('created_at', { ascending: false })
    .returns<IdeaSubmission[]>()
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
