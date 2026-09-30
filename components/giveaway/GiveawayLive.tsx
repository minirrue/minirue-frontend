'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import styles from './giveaway.module.css';
import {
  formatCairoTime,
  formatCountdown,
  formatDay,
  formatEgp,
  type GiveawayEntrant,
  type GiveawaySlug,
  type GiveawaySnapshot,
} from '@/lib/api/giveaway';
import { useGiveawayLive, useServerNow } from '@/lib/hooks/use-giveaway-live';

const POOL_WHERE: Record<GiveawaySlug, string> = {
  booth: 'at our booth',
  online: 'online at minirueshop.com',
};

const noopSubscribe = () => () => {};

function refLabel(ref: number): string {
  return `No. ${String(ref).padStart(2, '0')}`;
}

function Ledger({
  title,
  count,
  entrants,
  winnerRef,
  fresh,
  timezone,
  emptyText,
}: {
  title: string;
  count: string;
  entrants: GiveawayEntrant[];
  winnerRef: number | null;
  fresh: ReadonlySet<number>;
  timezone: string;
  emptyText: string | null;
}) {
  return (
    <section aria-label={title}>
      <div className={styles.ledgerHead}>
        <h2 className={styles.ledgerTitle}>{title}</h2>
        <span className={styles.ledgerCount}>{count}</span>
      </div>
      {entrants.length === 0 && emptyText ? (
        <p className={styles.empty}>{emptyText}</p>
      ) : (
        <ol className={styles.ledger}>
          {entrants.map((e) => (
            <li
              key={e.ref}
              className={[
                styles.row,
                fresh.has(e.ref) ? styles.rowNew : '',
                winnerRef === e.ref ? styles.rowWinner : '',
              ].join(' ')}
            >
              <span className={styles.ref}>{refLabel(e.ref)}</span>
              <span className={e.name ? styles.name : `${styles.name} ${styles.nameHidden}`}>
                {e.name ?? 'Entrant'}
                {winnerRef === e.ref ? <span className={styles.srOnly}> (winner)</span> : null}
              </span>
              <span className={styles.meta}>
                {e.phoneTail ? `•• ${e.phoneTail} · ` : ''}
                {formatCairoTime(e.qualifiedAt, timezone)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/**
 * One live giveaway page — /giveaway/booth or /giveaway/online
 * (minirue-frontend#205). A face-down card between two ledgers of entrants;
 * at the reveal time the backend pushes the winner and every open page turns
 * the card over at once.
 */
export default function GiveawayLive({
  slug,
  initial,
}: {
  slug: GiveawaySlug;
  initial: GiveawaySnapshot;
}) {
  const { snapshot, offsetMs, transport } = useGiveawayLive(slug, initial);
  const snap = snapshot ?? initial;
  const now = useServerNow(offsetMs);

  // Countdown text depends on the device clock: the server snapshot (false)
  // renders during hydration, the client one (true) right after.
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  // A page opened after the reveal shows the result without replaying it.
  const [openedRevealed] = useState(
    () => initial.state === 'REVEALED' || initial.state === 'NO_ENTRIES',
  );

  // Rows that arrived while this page was open get a brief highlight.
  const seen = useRef<Set<number>>(new Set((initial.entrants ?? []).map((e) => e.ref)));
  const [fresh, setFresh] = useState<ReadonlySet<number>>(new Set());
  const entrants = snap.entrants ?? [];
  const refsKey = entrants.map((e) => e.ref).join(',');
  useEffect(() => {
    const arrived = entrants.filter((e) => !seen.current.has(e.ref)).map((e) => e.ref);
    if (arrived.length === 0) return;
    arrived.forEach((r) => seen.current.add(r));
    setFresh(new Set(arrived));
    const t = setTimeout(() => setFresh(new Set()), 2800);
    return () => clearTimeout(t);
    // refsKey stands for `entrants`; a fresh array every event must not loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refsKey]);

  if (snap.state === 'OFF') return <GiveawayOff />;

  const tz = snap.timezone;
  const revealAt = snap.revealAt as string;
  const revealTime = formatCairoTime(revealAt, tz);
  const revealed = snap.state === 'REVEALED';
  const flipped = revealed || snap.state === 'NO_ENTRIES';
  const winnerRef = revealed && snap.winner ? snap.winner.ref : null;
  const left = entrants.filter((_, i) => i % 2 === 0);
  const right = entrants.filter((_, i) => i % 2 === 1);
  const countText = `${entrants.length} ${entrants.length === 1 ? 'entrant' : 'entrants'}`;
  const minSpend = formatEgp(snap.minSpendMinor ?? 0);
  const emptyText =
    snap.state === 'OPEN'
      ? `No entries yet. Spend ${minSpend} today to be the first.`
      : 'No one entered today.';

  let statusLine: React.ReactNode;
  const countdown = mounted ? formatCountdown(Date.parse(revealAt) - now) : null;
  switch (snap.state) {
    case 'OPEN':
    case 'DRAWN':
      statusLine = (
        <>
          <p className={styles.statusLine}>
            {snap.state === 'DRAWN'
              ? `Entries are closed. The winner is revealed at ${revealTime}`
              : `The winner is revealed at ${revealTime}`}
          </p>
          <span className={styles.countdown} aria-hidden={!countdown}>
            {countdown ?? '\u00a0'}
          </span>
        </>
      );
      break;
    case 'PENDING_DRAW':
      statusLine = <p className={styles.statusLine}>The winner will be announced shortly.</p>;
      break;
    case 'NO_ENTRIES':
      statusLine = <p className={styles.statusLine}>No one reached {minSpend} today.</p>;
      break;
    default:
      statusLine = (
        <p className={styles.statusLine}>
          Congratulations{snap.winner?.name ? `, ${snap.winner.name}` : ''}! We will call you
          on the number you ordered with.
        </p>
      );
  }

  const ledgerProps = { winnerRef, fresh, timezone: tz };

  return (
    <main className={styles.main}>
      <header className={styles.head}>
        <h1 className={styles.title}>{snap.title}</h1>
        <p className={styles.date}>{formatDay(snap.day)}</p>
        <p className={styles.rule}>
          Spend <strong>{minSpend}</strong> or more today {POOL_WHERE[slug]}
          {snap.countsShipping ? '' : ' (delivery fees not included)'} and you are in the draw
          automatically. One entry per person.
        </p>
      </header>

      {snap.prize && (snap.prize.title || snap.prize.imageUrl) ? (
        <section className={styles.prize} aria-label="Prize">
          {snap.prize.imageUrl && snap.prize.mediaKind === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed imgproxy URL
            <img className={styles.prizeMedia} src={snap.prize.imageUrl} alt="" />
          ) : snap.prize.imageUrl ? (
            <video className={styles.prizeMedia} src={snap.prize.imageUrl} muted autoPlay loop playsInline />
          ) : null}
          <div className={styles.prizeText}>
            <h2 className={styles.prizeTitle}>
              <span className={styles.prizeLead}>Today&apos;s prize: </span>
              {snap.prize.title}
            </h2>
            {snap.prize.description ? <p className={styles.prizeDesc}>{snap.prize.description}</p> : null}
          </div>
        </section>
      ) : null}

      <div className={styles.stage}>
        <div className={styles.colLeft}>
          <Ledger title="Entrants" count={countText} entrants={left} emptyText={emptyText} {...ledgerProps} />
        </div>

        <div className={styles.cardCol}>
          <div
            className={[
              styles.cardScene,
              flipped ? styles.flipped : '',
              openedRevealed ? styles.static : '',
            ].join(' ')}
          >
            <div className={styles.card} data-testid="giveaway-card" data-state={snap.state}>
              <div className={`${styles.face} ${styles.back}`} aria-hidden={flipped}>
                <span className={styles.question} aria-hidden>
                  ?
                </span>
                <span className={styles.backMark} aria-hidden>
                  MINIRUE
                </span>
                <span className={styles.srOnly}>The winner has not been revealed yet.</span>
              </div>
              <div className={`${styles.face} ${styles.front}`} aria-hidden={!flipped}>
                {revealed && snap.winner ? (
                  <>
                    <p className={styles.winnerName}>{snap.winner.name ?? refLabel(snap.winner.ref)}</p>
                    {snap.winner.phoneTail ? (
                      <p className={styles.winnerPhone}>Phone ending •• {snap.winner.phoneTail}</p>
                    ) : null}
                    <p className={styles.frontLabel}>TODAY&apos;S WINNER</p>
                    <span className={styles.winnerRef}>ENTRANT {refLabel(snap.winner.ref).toUpperCase()}</span>
                  </>
                ) : (
                  <>
                    <p className={styles.noEntries}>No entries today</p>
                    <p className={styles.noEntriesSub}>There is always tomorrow.</p>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className={styles.status} aria-live="polite">
            {statusLine}
            <span className={styles.liveDot} data-transport={transport}>
              {transport === 'live' ? 'LIVE' : transport === 'polling' ? 'UPDATING' : 'CONNECTING'}
            </span>
          </div>
        </div>

        <div className={styles.colRight}>
          <Ledger title="In the draw" count={countText} entrants={right} emptyText={null} {...ledgerProps} />
        </div>

        <div className={styles.colMerged}>
          <Ledger title="Entrants" count={countText} entrants={entrants} emptyText={emptyText} {...ledgerProps} />
        </div>
      </div>

      <footer className={styles.terms}>
        <h2 className={styles.termsTitle}>How it works</h2>
        <ul className={styles.termsList}>
          <li>
            Everyone who spends {minSpend} or more {POOL_WHERE[slug]} on {formatDay(snap.day)} (Cairo
            time) is entered automatically. Orders add up across the day.
          </li>
          <li>What counts is what you pay after discounts{snap.countsShipping ? '' : ', without delivery fees'}. Cancelled or refunded orders do not count.</li>
          <li>One entry per person, however much you spend. The winner is drawn from today&apos;s entrants and revealed here at {revealTime}.</li>
          <li>Names are shortened for privacy. Ask us if you would rather not be listed; you stay in the draw.</li>
        </ul>
        {snap.terms ? <p className={styles.termsBody}>{snap.terms}</p> : null}
      </footer>
    </main>
  );
}

export function GiveawayOff() {
  return (
    <main className={styles.main}>
      <div className={styles.off}>
        <h1 className={styles.title}>No giveaway running right now</h1>
        <p className={styles.offText}>
          Our giveaways run on selected days, online and at our booth. Check back soon, or follow us to
          hear about the next one.
        </p>
        <Link className={styles.button} href="/shop">
          SHOP MINIRUE
        </Link>
      </div>
    </main>
  );
}
