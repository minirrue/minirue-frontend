import { NextRequest, NextResponse } from 'next/server'

// Routes that require authentication (W1 stub — ready for /account/* in future)
const PROTECTED = ['/account']
// Auth pages — redirect away if already logged in
const AUTH_PAGES = ['/login', '/signup', '/forgot', '/reset-password']
// Cookie name — must match tokens.ts (mr-auth)
const AUTH_COOKIE = 'mr-auth'

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isAuthed = request.cookies.has(AUTH_COOKIE)

  // Redirect unauthenticated users away from protected routes
  if (!isAuthed && PROTECTED.some(p => pathname.startsWith(p))) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
