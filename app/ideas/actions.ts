'use server'

import { randomUUID } from 'node:crypto'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/supabase/admin'
import { friendlyError } from '@/lib/labels'
import { BUCKET, DOC_TYPES, IMAGE_TYPES, MAX_FILES, MAX_FILE_BYTES } from '@/lib/ideas'

type FileMeta = { name: string; type: string; size: number }
type Upload = { path: string; token: string }

const safeName = (n: string) => n.replace(/[^\w.\- ]+/g, '_').replace(/\s+/g, '_').slice(-80) || 'file'

// A light brake on spam: 12 entries an hour from one address (per server instance).
const hits = new Map<string, number[]>()
async function tooMany() {
  const h = await headers()
  const ip = (h.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim()
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3_600_000)
  recent.push(now)
  hits.set(ip, recent)
  return recent.length > 12
}

// Step 1 of a submit with files: permission slips so the browser can upload
// straight to private storage (big files never pass through the website).
export async function prepareUploads(files: FileMeta[]): Promise<{ error?: string; folder?: string; uploads?: Upload[] }> {
  if (files.length > MAX_FILES) return { error: `You can add up to ${MAX_FILES} files.` }
  if (await tooMany()) return { error: 'That is a lot of entries from one place. Try again in a little while.' }

  const folder = randomUUID()
  const uploads: Upload[] = []
  for (const f of files) {
    if (![...IMAGE_TYPES, ...DOC_TYPES].includes(f.type)) {
      return { error: `“${f.name}” isn’t a file type we can take. Use a screenshot, PDF, Word or PowerPoint.` }
    }
    if (f.size > MAX_FILE_BYTES) return { error: `“${f.name}” is over 5 MB. Try a smaller file.` }
    const path = `${folder}/${randomUUID()}-${safeName(f.name)}`
    const { data, error } = await db().storage.from(BUCKET).createSignedUploadUrl(path)
    if (error || !data) {
      return { error: 'Attachments aren’t switched on yet. You can still send this without files.' }
    }
    uploads.push({ path, token: data.token })
  }
  return { folder, uploads }
}

export async function submitIdea(input: {
  kind: string
  area: string
  title: string
  details: string
  website?: string
  folder?: string
  files: { path: string; name: string; mime: string; size: number }[]
}): Promise<{ error?: string; ok?: true }> {
  // Hidden box that only robots fill in: pretend it worked
  if (input.website) return { ok: true }
  if (input.files.length === 0 && (await tooMany())) {
    return { error: 'That is a lot of entries from one place. Try again in a little while.' }
  }
  const { error } = await db().rpc('idea_submit_public', {
    p_folder: input.folder ?? randomUUID(),
    p_kind: input.kind,
    p_area: input.area,
    p_title: input.title,
    p_details: input.details,
    p_files: input.files,
  })
  if (error) return { error: friendlyError(error.message) }
  revalidatePath('/admin')
  return { ok: true }
}
