import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import GiveawayChrome from '@/components/giveaway/GiveawayChrome';
import GiveawayLive, { GiveawayOff } from '@/components/giveaway/GiveawayLive';
import { fetchGiveaway, GIVEAWAY_SLUGS, type GiveawaySlug } from '@/lib/api/giveaway';

/**
 * /giveaway/booth and /giveaway/online (minirue-frontend#205): today's live
 * draw for one pool. Rendered on the server with the current snapshot so the
 * card and the list paint at once; GiveawayLive then keeps it live over SSE.
 */
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ pool: string }>;
}

function slugOf(raw: string): GiveawaySlug | null {
  return raw in GIVEAWAY_SLUGS ? (raw as GiveawaySlug) : null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const slug = slugOf((await params).pool);
  if (!slug) return { title: 'Page not found' };
  const snap = await fetchGiveaway(slug).catch(() => null);
  if (!snap || snap.state === 'OFF') {
    return { title: 'Giveaway — MiniRue', robots: { index: false, follow: true } };
  }
  return {
    title: `${snap.title} — MiniRue`,
    description: 'Today’s live MiniRue giveaway. Watch the entries come in and the winner revealed.',
    alternates: { canonical: `/giveaway/${slug}` },
  };
}

export default async function GiveawayPoolPage({ params }: PageProps) {
  const slug = slugOf((await params).pool);
  if (!slug) notFound();
  const snap = await fetchGiveaway(slug).catch(() => null);
  // Always the live component, even when switched off: it shows the closed
  // page but stays subscribed, so switching the giveaway on in the dashboard
  // reaches a page that is already open.
  return (
    <GiveawayChrome>
      {snap ? <GiveawayLive slug={slug} initial={snap} /> : <GiveawayOff />}
    </GiveawayChrome>
  );
}
