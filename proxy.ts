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

// ── Web analytics: visitor id + attribution capture ─────────────────────────
//
// This proxy is the only place that sees every first HTML request before any
// client JS runs, so it is where the visitor id is minted and where a UTM /
// referrer source signal is captured before the query string can be dropped
// by client-side navigation.

const VISITOR_COOKIE = 'mr-vid'
const ATTR_LAST_COOKIE = 'mr-attr-last'
const ATTR_FIRST_COOKIE = 'mr-attr-first'
const ATTR_PUB_COOKIE = 'mr-attr-pub'

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365
const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30

const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const

const MAX_ATTR_FIELD_CHARS = 128
const MAX_ATTR_PAYLOAD_BYTES = 512

interface AttributionPayload {
  s?: string
  m?: string
  c?: string
  ct?: string
  tm?: string
  ref?: string
  landing: string
  at: number
}

function truncateField(value: string): string {
  return value.length > MAX_ATTR_FIELD_CHARS ? value.slice(0, MAX_ATTR_FIELD_CHARS) : value
}

/**
 * UTF-8 safe base64url — `btoa` alone throws on non-Latin1 input (e.g. a
 * campaign name with non-ASCII characters), and neither `btoa` nor `Buffer`
 * is guaranteed present in every runtime this proxy might execute under, so
 * this only relies on `TextEncoder`/`btoa`, which both are.
 */
function toBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Encodes the attribution payload, dropping the least essential fields under
 * size pressure until the result fits the 512-byte budget. Source/medium,
 * landing path and timestamp are load-bearing for reporting; term, content
 * and referrer host are the first to go.
 */
function encodeAttributionPayload(payload: AttributionPayload): string {
  const draft: AttributionPayload = { ...payload }
  const dropOrder: (keyof AttributionPayload)[] = ['tm', 'ct', 'ref']

  let encoded = toBase64Url(JSON.stringify(draft))
  for (const key of dropOrder) {
    if (encoded.length <= MAX_ATTR_PAYLOAD_BYTES) break
    delete draft[key]
    encoded = toBase64Url(JSON.stringify(draft))
  }
  return encoded
}

interface SourceSignal {
  hasSignal: boolean
  utm: Partial<Record<(typeof UTM_PARAMS)[number], string>>
  refHost: string | null
}

/** A source signal is any utm_* query param, or a Referer whose host is not our own. */
function readSourceSignal(request: NextRequest): SourceSignal {
  const utm: SourceSignal['utm'] = {}
  let hasUtm = false
  for (const key of UTM_PARAMS) {
    const value = request.nextUrl.searchParams.get(key)
    if (value) {
      utm[key] = value
      hasUtm = true
    }
  }

  let refHost: string | null = null
  const referer = request.headers.get('referer')
  if (referer) {
    try {
      const refUrl = new URL(referer)
      if (refUrl.host !== request.nextUrl.host) {
        refHost = refUrl.host
      }
    } catch {
      // Malformed Referer header — treat as no referrer.
    }
  }

  return { hasSignal: hasUtm || refHost !== null, utm, refHost }
}

interface CookieBase {
  domain: string | undefined
  path: string
  sameSite: 'lax'
  secure: boolean
}

function applyVisitorCookie(res: NextResponse, request: NextRequest, base: CookieBase): void {
  if (!request.cookies.has(VISITOR_COOKIE)) {
    res.cookies.set(VISITOR_COOKIE, crypto.randomUUID(), {
      ...base,
      httpOnly: true,
      maxAge: ONE_YEAR_SECONDS,
    })
  }
}

function applyAttributionCookies(res: NextResponse, request: NextRequest, base: CookieBase): void {
  const { hasSignal, utm, refHost } = readSourceSignal(request)
  if (!hasSignal) return

  const payload: AttributionPayload = {
    s: utm.utm_source ? truncateField(utm.utm_source) : undefined,
    m: utm.utm_medium ? truncateField(utm.utm_medium) : undefined,
    c: utm.utm_campaign ? truncateField(utm.utm_campaign) : undefined,
    ct: utm.utm_content ? truncateField(utm.utm_content) : undefined,
    tm: utm.utm_term ? truncateField(utm.utm_term) : undefined,
    ref: refHost ? truncateField(refHost) : undefined,
    landing: truncateField(request.nextUrl.pathname),
    at: Date.now(),
  }

  const encoded = encodeAttributionPayload(payload)

  // Last-touch: always overwrite.
  res.cookies.set(ATTR_LAST_COOKIE, encoded, {
    ...base,
    httpOnly: true,
    maxAge: THIRTY_DAYS_SECONDS,
  })

  // First-touch: write only once.
  if (!request.cookies.has(ATTR_FIRST_COOKIE)) {
    res.cookies.set(ATTR_FIRST_COOKIE, encoded, {
      ...base,
      httpOnly: true,
      maxAge: ONE_YEAR_SECONDS,
    })
  }

  // Public mirror of the last-touch value — not HttpOnly, so the checkout
  // POST can read it in JS (see lib/analytics/attribution.ts).
  res.cookies.set(ATTR_PUB_COOKIE, encoded, {
    ...base,
    httpOnly: false,
    maxAge: THIRTY_DAYS_SECONDS,
  })
}

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isAuthed = request.cookies.has(AUTH_COOKIE)

  // Build the response object once so visitor/attribution cookies can be set
  // on it regardless of which branch below produced it — a visitor bounced
  // to /login must still get an id.
  let res: NextResponse
  if (!isAuthed && PROTECTED.some(p => pathname.startsWith(p))) {
    // Redirect unauthenticated users away from protected routes
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    res = NextResponse.redirect(loginUrl)
  } else {
    res = NextResponse.next()
  }

  // Crawlers fetching non-HTML resources (robots.txt, sitemap.xml, RSS feeds,
  // etc.) must never mint a visitor id or attribution cookies — the matcher
  // below already covers every HTML route, but also everything else, so this
  // is the only gate between a bot request and a fake "visitor".
  const accept = request.headers.get('accept') ?? ''
  if (!accept.includes('text/html')) {
    return res
  }

  // `NEXT_PUBLIC_COOKIE_DOMAIN` (e.g. `.minirue.com`) is expected but not
  // required — see .env.example. Without it, cookies fall back to host-only,
  // which means the storefront and the API (separate origins per
  // NEXT_PUBLIC_API_URL, lib/api/client.ts:10) never share them, and every
  // visitor silently degrades to a server-side fingerprint. This is the
  // single most likely deployment failure in the whole analytics feature.
  const domain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN
  const base: CookieBase = { domain, path: '/', sameSite: 'lax', secure: true }

  applyVisitorCookie(res, request, base)
  applyAttributionCookies(res, request, base)

  return res
}

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
