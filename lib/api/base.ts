/** Browser calls use the storefront's /v1 rewrite. Keep backend origins server-only. */
const serverApiOrigin = (
  process.env.API_PROXY_ORIGIN ??
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:8002')
).replace(/\/$/, '');

export const API_BASE = typeof window === 'undefined'
  ? `${serverApiOrigin}/v1`
  : `${window.location.origin}/v1`;
