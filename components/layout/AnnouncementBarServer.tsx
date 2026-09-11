import { apiGetPublicSettings } from '@/lib/api/settings';
import AnnouncementBar from './AnnouncementBar';

/**
 * Server wrapper that feeds AnnouncementBar the configured storefront copy.
 *
 * Why this exists: AnnouncementBar takes `messages` as an optional prop with a
 * hardcoded default, so any route that rendered `<AnnouncementBar />` bare got
 * placeholder marketing copy — including a euro price on a shop that sells in
 * EGP. Nine of fifteen call sites did exactly that, which is every shop and
 * product route. An optional prop with a marketing default fails silently, and
 * the next new route would have failed the same way.
 *
 * Rendering through this wrapper means a route cannot forget. It does not fetch
 * per call site: apiGetPublicSettings uses `next: { revalidate: 60 }`, so Next's
 * Data Cache dedupes every call within a request.
 *
 * Client components cannot use this (it is async). They receive the config from
 * their own server parent — see ProductPageClient.
 */
export default async function AnnouncementBarServer() {
  // Resolve the config first, then render. Constructing JSX inside the try block
  // would swallow render-time errors as if they were fetch failures.
  let s: Awaited<ReturnType<typeof apiGetPublicSettings>>['storefront'] | null = null;
  try {
    s = (await apiGetPublicSettings()).storefront;
  } catch {
    // Settings unreachable. Render nothing rather than placeholder copy — a
    // missing bar is invisible; a bar advertising the wrong currency is a
    // support ticket.
    s = null;
  }

  if (!s) return null;

  return (
    <AnnouncementBar
      messages={s.announcementMessages}
      enabled={s.announcementEnabled}
      linkUrl={s.announcementLinkUrl ?? null}
      background={s.announcementBackground ?? null}
    />
  );
}
