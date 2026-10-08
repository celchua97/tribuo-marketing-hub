'use server'

import { randomUUID } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/supabase/admin'
import { IDEA_COOKIE, PERSON_COOKIE_OPTIONS } from '@/lib/session'
import { friendlyError } from '@/lib/labels'
import { BUCKET, DOC_TYPES, IMAGE_TYPES, MAX_FILES, MAX_FILE_BYTES, getIdeaPerson } from '@/lib/ideas'
import type { ActionState } from '../(app)/actions'

function text(formData: FormData, key: string) {
  const v = formData.get(key)
  return typeof v === 'string' ? v.trim() : ''
}

async function remember(id: string) {
  ;(await cookies()).set(IDEA_COOKIE, id, PERSON_COOKIE_OPTIONS)
}

// First time: a name and a department.
export async function joinIdeaBank(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { data, error } = await db().rpc('idea_join', {
    p_name: text(formData, 'name'),
    p_department: text(formData, 'department_id') || null,
  })
  if (error) return { error: friendlyError(error.message) }
  await remember(data as string)
  redirect('/ideas')
}

// Tap your name on the list (new phone).
export async function pickIdeaPerson(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = text(formData, 'person_id')
  const { data } = await db().from('idea_people').select('id').eq('id', id).maybeSingle()
  if (!data) return { error: 'We couldn’t find that person. Try again.' }
  await remember(data.id)
  redirect('/ideas')
}

export async function switchIdeaPerson() {
  ;(await cookies()).delete(IDEA_COOKIE)
  redirect('/ideas')
}

type FileMeta = { name: string; type: string; size: number }
type Upload = { path: string; token: string }

const safeName = (n: string) => n.replace(/[^\w.\- ]+/g, '_').replace(/\s+/g, '_').slice(-80) || 'file'

// Step 1 of a submit with files: permission slips so the browser can upload
// straight to private storage (big files never pass through the website).
export async function prepareUploads(files: FileMeta[]): Promise<{ error?: string; uploads?: Upload[] }> {
  const person = await getIdeaPerson()
  if (!person) return { error: 'Choose who you are first, then try again.' }
  if (files.length > MAX_FILES) return { error: `You can add up to ${MAX_FILES} files.` }

  const uploads: Upload[] = []
  for (const f of files) {
    if (![...IMAGE_TYPES, ...DOC_TYPES].includes(f.type)) {
      return { error: `“${f.name}” isn’t a file type we can take. Use a screenshot, PDF, Word or PowerPoint.` }
    }
    if (f.size > MAX_FILE_BYTES) return { error: `“${f.name}” is over 5 MB. Try a smaller file.` }
    const path = `${person.id}/${randomUUID()}-${safeName(f.name)}`
    const { data, error } = await db().storage.from(BUCKET).createSignedUploadUrl(path)
    if (error || !data) {
      return { error: 'Attachments aren’t switched on yet. You can still send this without files.' }
    }
    uploads.push({ path, token: data.token })
  }
  return { uploads }
}

export async function submitIdea(input: {
  kind: string
  area: string
  title: string
  details: string
  files: { path: string; name: string; mime: string; size: number }[]
}): Promise<{ error?: string; ok?: true }> {
  const person = await getIdeaPerson()
  if (!person) return { error: 'Choose who you are first, then try again.' }
  const { error } = await db().rpc('idea_submit', {
    p_person: person.id,
    p_kind: input.kind,
    p_area: input.area,
    p_title: input.title,
    p_details: input.details,
    p_files: input.files,
  })
  if (error) return { error: friendlyError(error.message) }
  revalidatePath('/ideas', 'layout')
  revalidatePath('/admin')
  return { ok: true }
}

export async function withdrawIdea(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const person = await getIdeaPerson()
  if (!person) return { error: 'Choose who you are first.' }
  const supabase = db()
  const { data, error } = await supabase.rpc('idea_withdraw', { p_person: person.id, p_id: text(formData, 'id') })
  if (error) return { error: friendlyError(error.message) }
  const paths = (data as string[] | null) ?? []
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths)
  revalidatePath('/ideas', 'layout')
  revalidatePath('/admin')
  return undefined
}
