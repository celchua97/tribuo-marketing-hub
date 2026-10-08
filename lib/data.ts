import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from './supabase/server'
import type { Profile } from './types'

export const VIDEO_WITH_NAMES =
  '*, pillar:content_pillars(name), assignee:profiles!videos_assignee_id_fkey(full_name)'

export const getMe = cache(async () => {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const userId = claims?.claims?.sub
  if (!userId) redirect('/login')
  const { data: me } = await supabase.from('profiles').select('*').eq('id', userId).single<Profile>()
  return { supabase, me }
})

export async function requireMe() {
  const { supabase, me } = await getMe()
  if (!me || !me.active) redirect('/login?error=no_profile')
  return { supabase, me }
}

export async function requireLead() {
  const ctx = await requireMe()
  if (ctx.me.role !== 'lead') redirect('/')
  return ctx
}
