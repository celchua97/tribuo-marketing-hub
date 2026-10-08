import Link from 'next/link'
import { requireMe } from '@/lib/data'
import { ROLE_COLOR, ROLE_LABEL } from '@/lib/labels'
import { TopBar } from '@/components/top-bar'
import { AdminButton } from '@/components/admin-button'

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { me } = await requireMe()
  return (
    <div className="min-h-dvh pb-16">
      <TopBar>
        <span className={`size-3 shrink-0 rounded-full ${ROLE_COLOR[me.role].dot}`} />
        <span className="flex flex-col pr-1 leading-tight">
          <span className="whitespace-nowrap font-bold text-ink">{me.full_name}</span>
          <span className="label-caps whitespace-nowrap text-[10px] text-grey">{ROLE_LABEL[me.role]}</span>
        </span>
        <Link href="/ideas" className="rounded-full px-2.5 py-2 hover:bg-white">
          Idea Bank
        </Link>
        {me.role === 'lead' && <AdminButton />}
        <Link href="/who" className="rounded-full px-2.5 py-2 hover:bg-white">
          Switch
        </Link>
      </TopBar>
      {children}
    </div>
  )
}
