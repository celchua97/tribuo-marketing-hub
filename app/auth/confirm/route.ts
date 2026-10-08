import type { EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Handles the magic link. Supports both the token_hash template (works when the
// link is opened in a different browser, e.g. a phone's mail app) and the
// default PKCE code flow.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const tokenHash = searchParams.get('token_hash')
  const type = (searchParams.get('type') ?? 'email') as EmailOtpType
  const code = searchParams.get('code')
  const supabase = await createClient()

  let ok = false
  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    ok = !error
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    ok = !error
  }

  return NextResponse.redirect(new URL(ok ? '/' : '/login?error=link_expired', origin))
}
