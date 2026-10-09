import { getMe } from '@/lib/data'
import { PageBand, TopBar } from '@/components/top-bar'
import { AdminButton } from '@/components/admin-button'

export const dynamic = 'force-dynamic'

const WIDTH = 'max-w-[760px]'

// A public page: anyone with the link can use it, no name or sign in.
export default async function IdeasLayout({ children }: { children: React.ReactNode }) {
  const { me } = await getMe()
  const isAdmin = me?.role === 'lead'
  return (
    <div className="min-h-dvh pb-16">
      <TopBar label="Idea Bank" width={WIDTH}>
        {isAdmin && <AdminButton />}
      </TopBar>
      <PageBand title="Idea Bank" intro="Got an idea, or something we should know? Add it here. We read everything." nav={false} />
      <main className={`mx-auto ${WIDTH} space-y-6 px-4 py-6`}>{children}</main>
    </div>
  )
}
