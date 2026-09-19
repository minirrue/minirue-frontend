/**
 * The backend sets a readable (non-httpOnly) `mr-ads-off=1` cookie, scoped to
 * the shared cookie domain, on excluded devices (owner, staff, test —
 * minirue-backend commit 300bd54). Its presence means this device must never
 * report to ad platforms: see minirue-dashboard#111.
 *
 * First-party analytics (lib/analytics/track.ts) does NOT consult this — the
 * backend classifies those events itself from the same device signal. This
 * only gates the Meta/TikTok pixels.
 */
const ADS_OFF_COOKIE_PATTERN = /(?:^|;\s*)mr-ads-off=1(?:;|$)/;

/** Runtime check for use in regular (non-inline) TS/JS. */
export function isAdsOff(): boolean {
  try {
    if (typeof document === 'undefined') return false;
    return ADS_OFF_COOKIE_PATTERN.test(document.cookie);
  } catch {
    return false;
  }
}

/**
 * The same check, as a literal JS source fragment — for the inline <script>
 * base-code strings in app/layout.tsx. Those run in <head>, before hydration
 * and before any module import is possible, so the check has to be inlined
 * as source text rather than called as a function.
 */
export const ADS_OFF_INLINE_CHECK =
  '!/(?:^|;\\s*)mr-ads-off=1(?:;|$)/.test(document.cookie)';
