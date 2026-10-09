import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { db } from './supabase/admin'
import { PERSON_COOKIE } from './session'
import { getAdminEmail } from './admin-auth'
import type { Profile } from './types'

export const VIDEO_WITH_NAMES =
  '*, pillar:content_pillars(name), assignee:profiles!videos_assignee_id_fkey(full_name)'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// The person remembered on this device, if they're still on the team.
export const getMe = cache(async () => {
  // Read the cookie first: it marks every page as "built when someone visits",
  // so a deploy never tries to open the database while the site is being built.
  const id = (await cookies()).get(PERSON_COOKIE)?.value
  const supabase = db()
  if (!id || !UUID.test(id)) return { supabase, me: null }
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .eq('active', true)
    .maybeSingle<Profile>()
  return { supabase, me: data }
})

export async function requireMe() {
  const { supabase, me } = await getMe()
  if (!me) redirect('/who')
  return { supabase, me }
}

// Admin things need both: the Head of Marketing name AND a signed-in admin email.
export async function requireLead(next = '/admin') {
  const ctx = await requireMe()
  if (ctx.me.role !== 'lead') redirect('/')
  const email = await getAdminEmail()
  if (!email) redirect(`/login?next=${encodeURIComponent(next)}`)
  return { ...ctx, adminEmail: email }
}
