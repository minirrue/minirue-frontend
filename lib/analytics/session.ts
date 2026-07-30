/**
 * Per-tab session id (the `s` field on `AnalyticsEventBase`), minted once per
 * tab and kept in `sessionStorage` so it survives client-side navigation but
 * not a new tab/window.
 */
const SESSION_KEY = 'mr-analytics-session';

export function getTabSessionId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    let id = window.sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    // sessionStorage unavailable (private mode, quota) — events still send,
    // just without a stable per-tab id to stitch them together server-side.
    return undefined;
  }
}
