'use server'

import { updateTag } from 'next/cache'
import { requireLead } from '@/lib/data'

// "Refresh now": drop the 5 minute cache so the next view asks Meta again
export async function refreshMeta() {
  await requireLead('/performance')
  updateTag('meta')
}
