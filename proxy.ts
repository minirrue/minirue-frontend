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
/**
 * The /account and /orders gate USED to live here and no longer does.
 *
 * Next.js's own guidance, verbatim: "Always verify authentication and
 * authorization inside each Server Function rather than relying on Proxy
 * alone." The middleware → proxy rename in v16 exists to signal it — "we
 * recommend users avoid relying on Middleware unless no other options exist."
 *
 * Following it fixed a real bug rather than merely tidying. This file runs on
 * a different HOST from the API, so it never receives the httpOnly session
 * cookie and had to gate on `mr-auth`, a hint the client sets itself. That
 * hint is losable: any 401 on any request cleared it and nothing restored it
 * until the next sign-in, so a shopper with a live session was bounced off
 * /account indefinitely while the rest of the app still knew them.
 *
 * The gate now lives in `app/account/layout.tsx`, a Server Component on
 * minirueshop.com, which CAN read the real `.minirueshop.com`-scoped httpOnly
 * cookie via `cookies()`. Nothing here needs to know about sessions any more.
 *
 * `mr-auth` survives for one narrow job below — keeping an already-signed-in
 * visitor off /login and /signup — where being wrong costs a redirect, not
 * access, and where nothing else is readable at this layer.
 */

/**
 * The mirror of PROTECTED: routes that only make sense to a GUEST.
 *
 * Signing in again while already signed in mints a second session over a live
 * one — a fresh token pair, a fresh refresh row — and the previous access
 * token's `sid` is left pointing at a row that rotation then revokes. That is
 * the double-sign-in the owner asked to prevent, and it is also how a browser
 * ends up holding two credentials under one cookie name.
 *
 * `/forgot` and `/reset-password` are deliberately NOT here: someone signed in
 * on one device may legitimately be resetting a password they no longer trust.
 */
const AUTH_ONLY_FOR_GUESTS = ['/login', '/signup']
// Cookie name — must match tokens.ts (mr-auth)
const AUTH_COOKIE = 'mr-auth'

// ── Web analytics: visitor id + attribution capture ─────────────────────────
//
// This proxy is the only place that sees every first HTML request before any
// client JS runs, so it is where the visitor id is minted and where a UTM /
// referrer source signal is captured before the query string can be dropped
// by client-side navigation.

const VISITOR_COOKIE = 'mr-vid'
// Readable mirror of mr-vid (backend#224 / frontend#188). mr-vid is HttpOnly
// so client JS can never rescue it after a cookie clear; this mirror carries
// the same uuid, non-HttpOnly, so lib/analytics/attribution.ts can copy it
// into localStorage as a second rescue path. The server remains the only
// minter — this cookie is always set to whatever id mr-vid resolves to,
// never independently generated.
const VISITOR_MIRROR_COOKIE = 'mr-vid-c'
// Client fallback header (lib/analytics/transport.ts) — sent only when
// neither cookie is readable but localStorage still holds the old id.
const VISITOR_HEADER = 'x-mr-vid'
const ATTR_LAST_COOKIE = 'mr-attr-last'
const ATTR_FIRST_COOKIE = 'mr-attr-first'
const ATTR_PUB_COOKIE = 'mr-attr-pub'

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365
const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30

const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isValidUuid(value: string | null | undefined): value is string {
  return !!value && UUID_PATTERN.test(value)
}

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

/**
 * Resolves and (re-)issues the visitor id.
 *
 * mr-vid, when present, is authoritative and untouched — its format is not
 * re-validated here (a pre-existing cookie of any shape is still "the id").
 * When mr-vid is missing, the id is rescued in order from: the readable
 * mirror cookie, then the client's `x-mr-vid` header — both validated as a
 * uuid, since either can be attacker- or extension-supplied — and only mints
 * a fresh uuid when neither yields one. The server is the only minter; a
 * rescued id is never freshly generated here, only reused.
 *
 * The mirror is then kept in sync with whatever mr-vid resolves to,
 * regardless of which branch produced it — this also backfills the mirror
 * for a visitor who already had mr-vid before this cookie existed.
 */
function applyVisitorCookie(res: NextResponse, request: NextRequest, base: CookieBase): void {
  const existingVid = request.cookies.get(VISITOR_COOKIE)?.value
  let id = existingVid

  if (!id) {
    const mirror = request.cookies.get(VISITOR_MIRROR_COOKIE)?.value
    const header = request.headers.get(VISITOR_HEADER)
    id = isValidUuid(mirror) ? mirror : isValidUuid(header) ? header : crypto.randomUUID()

    res.cookies.set(VISITOR_COOKIE, id, {
      ...base,
      httpOnly: true,
      maxAge: ONE_YEAR_SECONDS,
    })
  }

  if (request.cookies.get(VISITOR_MIRROR_COOKIE)?.value !== id) {
    res.cookies.set(VISITOR_MIRROR_COOKIE, id, {
      ...base,
      httpOnly: false,
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
  if (isAuthed && AUTH_ONLY_FOR_GUESTS.some(p => pathname === p || pathname.startsWith(`${p}/`))) {
    // Already signed in — the sign-in and sign-up screens have nothing to
    // offer, and reaching them is how a second, parallel session gets minted
    // over the top of a live one (owner: "prohibit visiting /login ... to
    // prevent double sign in"). Bounced at the edge rather than by a
    // client-side effect, so it cannot flash the form first.
    //
    // `next` is honoured when present so the round trip a guest was sent on
    // still lands where it meant to; otherwise the account area.
    const next = request.nextUrl.searchParams.get('next')
    const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/account'
    res = NextResponse.redirect(new URL(safeNext, request.url))
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
