import { LoginForm } from './login-form'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-8">
        <p className="text-sm font-semibold tracking-wide text-blue uppercase">Tribuo</p>
        <h1 className="mt-1 text-3xl font-bold">Content board</h1>
        <p className="mt-2 text-ink/60">Sign in with your work email. We&rsquo;ll send you a link.</p>
      </div>
      <LoginForm initialError={error} />
    </main>
  )
}
