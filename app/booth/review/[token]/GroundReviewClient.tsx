'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import RemoteImage from '@/components/ui/RemoteImage';
import OrderCelebration from '@/components/checkout/OrderCelebration';
import { getGroundReview, claimGroundReview, type GroundReview } from '@/lib/api/ground-review';
import { useSessionState } from '@/lib/hooks/use-session-state';
import { formatMoney } from '@/lib/format/money';

const money = (minor: number) => formatMoney(minor / 100, 'EGP');
const statusCode = (error: unknown) => (error as { status?: number })?.status;

export default function GroundReviewClient({ token }: { token: string }) {
  const [review, setReview] = useState<GroundReview | null>(null);
  const [problem, setProblem] = useState<'unavailable' | 'connection' | null>(null);
  const [retry, setRetry] = useState(0);
  const [claimState, setClaimState] = useState<'ready' | 'saving' | 'done'>('ready');
  const [claimError, setClaimError] = useState<string | null>(null);
  const claimInFlight = useRef(false);
  const { isSignedIn, status: sessionStatus } = useSessionState();

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let terminal = false;
    let inFlight = false;
    async function load() {
      if (cancelled || terminal || inFlight || document.visibilityState === 'hidden') return;
      inFlight = true;
      controller = new AbortController();
      try {
        const next = await getGroundReview(token, controller.signal);
        if (cancelled) return;
        setReview(next);
        setProblem(null);
        terminal = next.status !== 'AWAITING_PAYMENT';
      } catch (error) {
        if (cancelled || controller.signal.aborted) return;
        terminal = statusCode(error) === 404 || statusCode(error) === 410;
        setProblem(terminal ? 'unavailable' : 'connection');
      } finally {
        inFlight = false;
        if (!cancelled && !terminal) timer = setTimeout(load, 4_000);
      }
    }
    function resume() {
      clearTimeout(timer);
      void load();
    }
    void load();
    window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      cancelled = true;
      controller?.abort();
      clearTimeout(timer);
      window.removeEventListener('online', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [token, retry]);

  async function claim() {
    if (claimInFlight.current || claimState === 'done') return;
    claimInFlight.current = true;
    setClaimState('saving');
    setClaimError(null);
    try {
      await claimGroundReview(token);
      setClaimState('done');
    } catch (error) {
      setClaimState('ready');
      setClaimError(statusCode(error) === 403
        ? 'This purchase is waiting for ownership verification. You can connect it using the same verified email supplied to our team. Phone-only purchases stay safely recorded until phone verification is available.'
        : statusCode(error) === 409
          ? 'This purchase cannot be connected right now. Ask our team to check its status.'
          : 'We could not connect your purchase. Check your connection and try again.');
    } finally {
      claimInFlight.current = false;
    }
  }

  const done = review?.status === 'COMPLETED';
  const expired = review?.status === 'EXPIRED' || problem === 'unavailable';
  const online = review?.salesMode === 'ONLINE';
  const returnPath = `/booth/review/${encodeURIComponent(token)}`;
  const authQuery = `?next=${encodeURIComponent(returnPath)}`;

  return <div className="ground-review">
    <header className="gr-header">
      <Link className="gr-brand" href="/" aria-label="MiniRue home">MiniRue</Link>
      <span>Private order review</span>
    </header>
    <main className="gr-main">
      {expired ? <section className="gr-message"><h1>This review is no longer available</h1><p>Ask a MiniRue team member for a fresh review link. If you have already paid, our team can check your receipt.</p><Link className="gr-secondary" href="/">Visit MiniRue</Link></section>
        : !review ? <section className="gr-message" aria-live="polite">
          <h1>{problem ? 'We could not open your review' : 'Opening your order'}</h1>
          <p>{problem ? 'Check your connection and try again, or ask our team for help.' : 'Your items and prices will appear here in a moment.'}</p>
          {problem ? <button className="gr-primary" onClick={() => setRetry(n => n + 1)}>Try again</button> : <div className="gr-loading" aria-label="Loading order" />}
        </section> : <>
          <section className="gr-intro">
            <h1>{done ? online ? 'Order confirmed' : 'Purchase complete' : 'Review your order'}</h1>
            <p>{done ? 'Your order has been confirmed by our team. Thank you for shopping with MiniRue.' : 'Check your items and prices while our team takes care of your order.'}</p>
            <div className={`gr-status ${done ? 'gr-status-done' : ''}`} role="status"><Icon name={done ? 'check' : 'bag'} size={20} />{done ? online ? 'Confirmed by our team' : 'Payment received · collected in person' : 'Waiting for staff confirmation'}</div>
            {review.orderNumber && <p className="gr-reference">Order {review.orderNumber}</p>}
          </section>
          {problem === 'connection' && <div className="gr-alert" role="alert"><p><strong>Connection interrupted.</strong> These are the last details received. Keep this page open, or ask our team to confirm the current status.</p><button onClick={() => setRetry(n => n + 1)}>Retry</button></div>}
          <div className="gr-grid">
            <section className="gr-order" aria-labelledby="gr-items-title">
              <div className="gr-section-heading"><h2 id="gr-items-title">Your items</h2><span>{review.items.reduce((n, item) => n + item.quantity, 0)} items</span></div>
              <ul className="gr-items">{review.items.map(item => <li className="gr-item" key={item.id}>
                <div className="gr-image">{item.imageUrl ? <RemoteImage src={item.imageUrl} width={76} height={76} alt="" /> : <Icon name="bag" size={28} />}</div>
                <div><h3>{item.name}</h3><p>{item.sizeMl ? `${item.sizeMl} ml · ` : ''}Quantity {item.quantity}</p><span>{money(item.unitPriceMinor)} each</span></div>
                <strong>{money(item.lineTotalMinor)}</strong>
              </li>)}</ul>
              <dl className="gr-totals"><div><dt>Subtotal</dt><dd>{money(review.subtotalMinor)}</dd></div>{!!review.discountMinor && <div><dt>Discount</dt><dd>−{money(review.discountMinor)}</dd></div>}<div><dt>{online ? 'Delivery' : 'Collection'}</dt><dd>{online ? money(review.shippingMinor) : 'With our team · Free'}</dd></div><div className="gr-grand"><dt>{done && !online ? 'Total paid' : 'Order total'}</dt><dd>{money(review.totalMinor)}</dd></div></dl>
              <p className="gr-note">These prices belong to this order. Ask our team if anything needs changing before confirmation.</p>
            </section>
            <aside className="gr-aside">
              <section className="gr-reward" aria-labelledby="gr-reward-title"><Icon name="gift" size={28} /><h2 id="gr-reward-title">{review.loyalty.expectedPoints.toLocaleString()} {done && !online ? 'reward points' : 'expected points'}</h2>
                <p>{review.loyalty.egpValueMinor == null ? 'Your reward value will appear when the conversion rate is available.' : `${money(review.loyalty.egpValueMinor)} in future reward value.`}</p>
                <p className="gr-note">{online ? 'Points become available after delivery and verification of your account.' : done ? 'Connect a verified account to keep your purchase history and eligible rewards together.' : 'Points are confirmed after staff receive payment and hand over your items. A verified account is required to claim them.'}</p>
              </section>
              <p className="gr-help">Our team confirms your order. You will not be asked to make an online payment on this page.</p>
            </aside>
          </div>
          {done && <section className="gr-account" aria-labelledby="gr-account-title"><h2 id="gr-account-title">Keep your receipt and rewards</h2><p>Connect using the verified email you gave our team. If you supplied only a phone number, your purchase stays recorded and your claim waits until phone verification is available. A purchase does not automatically create an online account.</p>{claimError && <p role="alert" className="gr-claim-error">{claimError}</p>}
            <div className="gr-actions">{claimState === 'done' ? <><span role="status">Purchase connected to your account.</span><Link className="gr-primary" href="/account/orders">View my orders<Icon name="arrowRight" size={18} /></Link></> : isSignedIn ? <button className="gr-primary" disabled={claimState === 'saving'} onClick={claim}>{claimState === 'saving' ? 'Connecting purchase…' : 'Connect this purchase'}<Icon name="arrowRight" size={18} /></button> : sessionStatus === 'unknown' ? <span role="status">Checking your account…</span> : <><a className="gr-primary" href={`/signup${authQuery}`}>Create my account<Icon name="arrowRight" size={18} /></a><a className="gr-secondary" href={`/login${authQuery}`}>I already have an account</a></>}</div>
          </section>}
          {done && <OrderCelebration orderNumber={review.orderNumber} />}
        </>}
    </main>
    <footer className="gr-footer"><span>MiniRue · Egypt</span><span>Need help? Ask our team.</span></footer>
  </div>;
}
