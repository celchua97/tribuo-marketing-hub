import type { SupabaseClient } from '@supabase/supabase-js'
import type { BriefTemplate, Market, Pillar } from './types'

export async function loadVideoFormData(supabase: SupabaseClient) {
  const [pillars, templates, episodes] = await Promise.all([
    supabase.from('content_pillars').select('*').eq('active', true).order('sort_order').returns<Pillar[]>(),
    supabase.from('brief_templates').select('*').order('sort_order').returns<BriefTemplate[]>(),
    supabase
      .from('videos')
      .select('market, episode_number')
      .not('episode_number', 'is', null)
      .returns<{ market: Market; episode_number: number }[]>(),
  ])
  const nextEpisode: Record<Market, number> = { MY: 1, KH: 1 }
  for (const row of episodes.data ?? []) {
    nextEpisode[row.market] = Math.max(nextEpisode[row.market], row.episode_number + 1)
  }
  return { pillars: pillars.data ?? [], templates: templates.data ?? [], nextEpisode }
}
