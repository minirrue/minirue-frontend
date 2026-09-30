import type { Metadata } from 'next';
import Link from 'next/link';
import GiveawayChrome from '@/components/giveaway/GiveawayChrome';
import { GiveawayOff } from '@/components/giveaway/GiveawayLive';
import styles from '@/components/giveaway/giveaway.module.css';
import {
  fetchGiveawayIndex,
  formatCairoTime,
  formatDay,
  slugOfPool,
} from '@/lib/api/giveaway';

/**
 * /giveaway (minirue-frontend#205): links to today's giveaways that are
 * switched on — the booth's and the online shop's are separate draws.
 */
export const dynamic = 'force-dynamic';

const POOL_NAME = { BOOTH: 'At our booth', ONLINE: 'Online' } as const;

export async function generateMetadata(): Promise<Metadata> {
  const index = await fetchGiveawayIndex().catch(() => null);
  if (!index || index.pools.length === 0) {
    return { title: 'Giveaway — MiniRue', robots: { index: false, follow: true } };
  }
  return {
    title: 'Today’s giveaways — MiniRue',
    alternates: { canonical: '/giveaway' },
  };
}

export default async function GiveawayIndexPage() {
  const index = await fetchGiveawayIndex().catch(() => null);
  const pools = index?.pools ?? [];
  if (pools.length === 0) {
    return (
      <GiveawayChrome>
        <GiveawayOff />
      </GiveawayChrome>
    );
  }
  return (
    <GiveawayChrome>
      <main className={styles.main}>
        <header className={styles.head}>
          <h1 className={styles.title}>Today&apos;s giveaways</h1>
          <p className={styles.date}>{formatDay(pools[0].day)}</p>
          <p className={styles.rule}>Each one is its own draw. Pick where you shopped.</p>
        </header>
        <div className={styles.pools}>
          {pools.map((p) => (
            <Link key={p.pool} className={styles.poolLink} href={`/giveaway/${slugOfPool(p.pool)}`}>
              <h2 className={styles.poolName}>{POOL_NAME[p.pool]}</h2>
              <p className={styles.poolMeta}>
                {p.title}
                <br />
                {p.entrantCount} {p.entrantCount === 1 ? 'entrant' : 'entrants'}
                {p.revealAt ? ` · winner at ${formatCairoTime(p.revealAt)}` : ''}
              </p>
            </Link>
          ))}
        </div>
      </main>
    </GiveawayChrome>
  );
}
