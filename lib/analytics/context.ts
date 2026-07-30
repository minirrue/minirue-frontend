import type { AnalyticsBatchContext } from './events';

// Cookie set by lib/api/cart.ts:53 (CART_SESSION_COOKIE). Not imported from
// there directly to avoid coupling this lane's bundle to an unrelated
// module's tree — the name is a stable, documented wire contract.
const CART_SESSION_COOKIE = 'mr-cart-session';

const LANDING_KEY = 'mr-analytics-landing';

interface LandingInfo {
  referrer: string;
  utm: { s?: string; m?: string; c?: string; ct?: string; tm?: string };
}

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

/**
 * The referrer and landing-page UTM params only mean something captured
 * ONCE, at the first page of the visit — after a client-side navigation,
 * `document.referrer` still points at whatever sent the visitor to the site,
 * but re-reading it on every batch would be redundant, and the UTM params
 * are usually gone from the URL after the first navigation. Cached in
 * `sessionStorage` so it survives client-side routing but resets per tab.
 */
function readLanding(): LandingInfo {
  if (typeof window === 'undefined') return { referrer: '', utm: {} };

  try {
    const cached = window.sessionStorage.getItem(LANDING_KEY);
    if (cached) return JSON.parse(cached) as LandingInfo;
  } catch {
    // fall through and recompute
  }

  const params = new URLSearchParams(window.location.search);
  const info: LandingInfo = {
    referrer: document.referrer ?? '',
    utm: {
      s: params.get('utm_source') ?? undefined,
      m: params.get('utm_medium') ?? undefined,
      c: params.get('utm_campaign') ?? undefined,
      ct: params.get('utm_content') ?? undefined,
      tm: params.get('utm_term') ?? undefined,
    },
  };

  try {
    window.sessionStorage.setItem(LANDING_KEY, JSON.stringify(info));
  } catch {
    // Storage unavailable — this just gets recomputed (as "this page") on
    // the next batch, which is a graceful degradation, not a crash.
  }

  return info;
}

interface ClientHintsNavigator {
  userAgentData?: {
    brands?: { brand: string; version: string }[];
    platform?: string;
    mobile?: boolean;
  };
}

/** Built once per batch (not per event) — see AnalyticsBatchContext for why. */
export function buildBatchContext(): AnalyticsBatchContext {
  if (typeof window === 'undefined') return {};

  const landing = readLanding();
  const nav = window.navigator as Navigator & ClientHintsNavigator;
  const hasUtm = Object.values(landing.utm).some(Boolean);

  const ctx: AnalyticsBatchContext = {
    r: landing.referrer || undefined,
    u: hasUtm ? landing.utm : undefined,
    cs: readCookie(CART_SESSION_COOKIE),
    w: window.innerWidth,
    h: window.innerHeight,
    l: nav.language,
    wd: nav.webdriver,
    cd: window.screen?.colorDepth,
    hc: nav.hardwareConcurrency,
    // `matchMedia` is absent during SSR/build (the `typeof window ===
    // 'undefined'` guard above already covers that) but is also missing or
    // non-callable in some older/embedded WebViews, so it's guarded again
    // here rather than assumed just because `window` exists.
    it: typeof window.matchMedia === 'function' ? window.matchMedia('(pointer: coarse)').matches : undefined,
    dp: typeof window.devicePixelRatio === 'number' ? Math.round(window.devicePixelRatio * 10) / 10 : undefined,
  };

  if (nav.userAgentData) {
    ctx.ch = {
      b: nav.userAgentData.brands?.map((b) => b.brand).join(','),
      pl: nav.userAgentData.platform,
      mo: nav.userAgentData.mobile,
    };
  }

  return ctx;
}
