import { NextResponse, type NextRequest } from 'next/server'
import { PERSON_COOKIE } from '@/lib/session'

// Everyone starts at "Who are you?". The page itself checks the cookie against
// the team list; this just saves a trip for brand-new visitors.
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/who')) return NextResponse.next()
  if (!request.cookies.get(PERSON_COOKIE)) {
    return NextResponse.redirect(new URL('/who', request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
