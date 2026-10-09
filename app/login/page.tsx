import { redirect } from 'next/navigation'
import { getAdminEmail } from '@/lib/admin-auth'
import { AdminLoginForm } from '@/components/admin-login-form'
import { PageBand, TopBar } from '@/components/top-bar'

export const dynamic = 'force-dynamic'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; link?: string }> }) {
  const { next = '/admin', link } = await searchParams
  const target = next.startsWith('/') && !next.startsWith('//') ? next : '/admin'
  if (await getAdminEmail()) redirect(target)
  return (
    <div className="min-h-dvh pb-16">
      <TopBar />
      <PageBand title="Admin sign in" nav={false} intro="Only people with admin access can get in. We email you a code." />
      <main className="mx-auto max-w-md px-4 py-6">
        {link === 'expired' && <p role="alert" className="mb-4 rounded-xl border-2 border-beige bg-white px-4 py-3 text-sm font-bold text-danger">That email link has expired or was already used. Ask for a new one below.</p>}
        <div className="card">
          <AdminLoginForm next={target} passcodeEnabled={(process.env.ADMIN_PASSCODE ?? '').length >= 12} />
        </div>
      </main>
    </div>
  )
}
