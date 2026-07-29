import { NextRequest, NextResponse } from 'next/server'

/**
 * Routes with no meaning for a guest, so a redirect is the honest answer.
 *
 * /cart and /checkout used to be here and are not any more. A guest CAN have a
 * cart — it is keyed by the mr-cart-session cookie and the backend accepts it
 * through OptionalJwtAuthGuard — and can fill in a delivery address. Bouncing
 * them at the door meant a shopper who added something and clicked the basket
 * was thrown at a sign-in form before they had decided to buy anything.
 * Identity is asked for once, at Place order, where it is genuinely needed.
 *
 * /account and /orders stay: there is nothing to show a guest on either.
 */
const PROTECTED = ['/account', '/orders']
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
