import type { SupabaseClient } from '@supabase/supabase-js'
import type { Market } from './types'

export async function loadVideoFormData(supabase: SupabaseClient) {
  const [episodes] = await Promise.all([
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
  return { nextEpisode }
}
