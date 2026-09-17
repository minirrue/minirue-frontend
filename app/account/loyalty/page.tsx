import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { apiGetMyLoyalty, type PointsTransaction, type PointsTxType } from '@/lib/api/loyalty';
import './loyalty.css';

export const metadata: Metadata = { title: 'Points — My Account — MiniRue', robots: 'noindex, nofollow' };

const TX_LABELS: Record<PointsTxType, string> = {
  EARN_ORDER: 'Earned from your order', EARN_SIGNUP: 'Welcome points', EARN_EMAIL_VERIFIED: 'Email verified',
  REDEEM: 'Points used', DEDUCT_REFUND: 'Order refund', EXPIRE: 'Points expired', MANUAL_ADJUST: 'Account adjustment',
};

function friendlyReason(tx: PointsTransaction): string | null {
  if (tx.note?.trim()) return tx.note.trim();
  if (tx.reason?.trim()) return tx.reason.trim().toLowerCase().replaceAll('_', ' ');
  return null;
}

function shortOrder(id: string): string { return `#${id.replaceAll('-', '').slice(0, 8).toUpperCase()}`; }

export default async function LoyaltyPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await cookies();
  const rawPage = Number((await searchParams).page ?? '1');
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit = 20;
  let loyalty: Awaited<ReturnType<typeof apiGetMyLoyalty>> | null = null;
  try { loyalty = await apiGetMyLoyalty({ page, limit }); } catch { /* recovery panel below */ }
  const totalPages = loyalty ? Math.max(1, Math.ceil(loyalty.total / loyalty.limit)) : 1;

  return (
    <main className="loyalty-page">
      <header className="loyalty-heading">
        <div><p className="loyalty-kicker">MiniRue points</p><h1>Your loyalty, beautifully simple.</h1><p>Every EGP spent earns two points after your order is completed.</p></div>
        {loyalty && <div className="loyalty-balance" aria-label={`${loyalty.balance.toLocaleString()} points available`}><span>Available</span><strong>{loyalty.balance.toLocaleString()}</strong><small>points</small></div>}
      </header>

      {!loyalty ? (
        <section className="loyalty-empty" role="alert"><h2>We couldn&apos;t load your points.</h2><p>Please refresh in a moment. Your earned points are safe.</p><Link href="/account/loyalty">Try again</Link></section>
      ) : (
        <>
          <section className="loyalty-summary" aria-label="Points summary">
            <div><span>Lifetime earned</span><strong>{loyalty.lifetimeEarned.toLocaleString()}</strong></div>
            <div><span>Used</span><strong>{loyalty.lifetimeRedeemed.toLocaleString()}</strong></div>
            <div><span>Adjustments</span><strong>{loyalty.lifetimeAdjusted.toLocaleString()}</strong></div>
          </section>

          <section className="loyalty-coming" aria-labelledby="loyalty-coming-title"><span aria-hidden="true">✦</span><div><h2 id="loyalty-coming-title">Spending points is coming soon</h2><p>Your balance is real and keeps growing. We&apos;ll let you know when rewards are ready—no made-up cash value in the meantime.</p></div></section>

          <section className="loyalty-how" aria-labelledby="loyalty-how-title">
            <div><p className="loyalty-kicker">How it works</p><h2 id="loyalty-how-title">Earn as you shop</h2></div>
            <ol><li><strong>1</strong><span>Shop signed in to your MiniRue account.</span></li><li><strong>2</strong><span>Receive your order and complete payment.</span></li><li><strong>3</strong><span>Get {loyalty.rules.pointsPerEgp} points for every EGP spent.</span></li></ol>
          </section>

          <section className="loyalty-history" aria-labelledby="loyalty-history-title">
            <div className="loyalty-section-head"><div><p className="loyalty-kicker">Your activity</p><h2 id="loyalty-history-title">Points history</h2></div><span>{loyalty.total.toLocaleString()} entries</span></div>
            {loyalty.history.length === 0 ? (
              <div className="loyalty-empty"><h3>Your first points are waiting.</h3><p>They will appear here after your first completed order.</p><Link href="/shop">Explore the shop</Link></div>
            ) : (
              <ol className="loyalty-ledger">{loyalty.history.map((tx) => {
                const positive = tx.delta > 0; const reason = friendlyReason(tx);
                return <li key={tx.id}><span className="loyalty-mark" data-positive={positive} aria-hidden="true">{positive ? '+' : '−'}</span><div className="loyalty-entry-copy"><strong>{TX_LABELS[tx.type] ?? 'Points update'}</strong>{tx.orderId && <Link href={`/account/orders/${tx.orderId}`}>Order {shortOrder(tx.orderId)}</Link>}{reason && <span className="loyalty-reason">{reason}</span>}<time dateTime={tx.createdAt}>{new Date(tx.createdAt).toLocaleDateString('en-EG', { day: 'numeric', month: 'short', year: 'numeric' })}</time></div><div className="loyalty-delta" data-positive={positive}><strong>{positive ? '+' : ''}{tx.delta.toLocaleString()}</strong><span>{tx.balanceAfter.toLocaleString()} balance</span></div></li>;
              })}</ol>
            )}
            {totalPages > 1 && <nav className="loyalty-pages" aria-label="Points history pages">{page > 1 ? <Link href={`/account/loyalty?page=${page - 1}`}>Previous</Link> : <span />}<span>Page {Math.min(page, totalPages)} of {totalPages}</span>{page < totalPages ? <Link href={`/account/loyalty?page=${page + 1}`}>Next</Link> : <span />}</nav>}
          </section>
        </>
      )}
    </main>
  );
}
