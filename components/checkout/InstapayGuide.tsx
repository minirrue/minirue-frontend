'use client';

import React from 'react';
import Image from 'next/image';
import Button from '@/components/ui/Button';
import { useBreakpoint } from '@/lib/hooks/useBreakpoint';
import {
  DEFAULT_INSTAPAY_GUIDE,
  loadInstapayGuide,
  type InstapayGuide as Guide,
} from '@/lib/api/settings';

/**
 * Where to pay, on the step that takes the receipt (#147).
 *
 * The InstaPay step used to show only an upload box, so a shopper who picked
 * InstaPay had no link, no handle and no idea which screenshot was wanted.
 * This is the whole route in reading order: the amount, the way to send it,
 * and the screen to capture. The upload below is step three.
 */

/** Longest the guide waits for the shop's own values before using the bundled ones. */
const SETTINGS_WAIT_MS = 4000;

/**
 * `null` while the settings read is in flight — not the defaults. Once the
 * shop publishes its own account (minirue-backend#170), painting the bundled
 * link first would put a tappable, wrong pay link on screen for a moment.
 */
export function useInstapayGuide(): Guide | null {
  const [guide, setGuide] = React.useState<Guide | null>(null);
  React.useEffect(() => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        setGuide(DEFAULT_INSTAPAY_GUIDE);
      }
    }, SETTINGS_WAIT_MS);
    void loadInstapayGuide().then((next) => {
      if (!settled) {
        settled = true;
        setGuide(next);
      }
    });
    return () => {
      settled = true;
      clearTimeout(timer);
    };
  }, []);
  return guide;
}

/** Remote images come from the media proxy already sized; local ones Next optimises. */
function isRemote(src: string): boolean {
  return /^https:\/\//i.test(src);
}

const LABEL: React.CSSProperties = {
  fontFamily: 'var(--mr-font-label)',
  fontSize: 'var(--mr-text-xs)',
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: 'var(--mr-fg-3)',
};

const BODY: React.CSSProperties = {
  fontFamily: 'var(--mr-font-ui)',
  fontSize: 'var(--mr-text-sm)',
  lineHeight: 1.55,
  color: 'var(--mr-fg-3)',
  margin: 0,
};

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li style={{ display: 'grid', gridTemplateColumns: '28px 1fr', columnGap: 'var(--mr-sp-3)' }}>
      <span
        aria-hidden
        style={{
          width: 28,
          height: 28,
          borderRadius: 'var(--mr-radius-pill)',
          border: '1px solid var(--mr-gold-300)',
          color: 'var(--mr-gold-700)',
          fontFamily: 'var(--mr-font-label)',
          fontSize: 'var(--mr-text-xs)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {n}
      </span>
      <div style={{ minWidth: 0 }}>
        <h3
          style={{
            fontFamily: 'var(--mr-font-ui)',
            fontSize: 'var(--mr-text-base)',
            fontWeight: 500,
            color: 'var(--mr-fg)',
            margin: '4px 0 var(--mr-sp-3)',
          }}
        >
          <span className="sr-only">Step {n}: </span>
          {title}
        </h3>
        {children}
      </div>
    </li>
  );
}

function CopyIcon({ done }: { done: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ display: 'block' }}>
      {done ? (
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      ) : (
        <>
          <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
          <path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" />
        </>
      )}
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ display: 'block' }}>
      <path d="M9 5h10v10M19 5L6 18" />
    </svg>
  );
}

function HandleRow({ handle }: { handle: string }) {
  const [state, setState] = React.useState<'idle' | 'copied' | 'failed'>('idle');

  const copy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(handle);
      setState('copied');
    } catch {
      setState('failed');
    }
    setTimeout(() => setState('idle'), 2000);
  }, [handle]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--mr-sp-3)',
        padding: '6px 6px 6px var(--mr-sp-4)',
        border: '1px solid var(--mr-hairline)',
        borderRadius: 'var(--mr-radius-pill)',
        background: 'var(--mr-cream-200)',
      }}
    >
      <span
        data-testid="instapay-handle"
        style={{
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontFamily: 'var(--mr-font-ui)',
          fontSize: 'var(--mr-text-base)',
          fontWeight: 500,
          color: 'var(--mr-fg)',
          userSelect: 'all',
        }}
      >
        {handle}
      </span>
      <Button
        variant={state === 'copied' ? 'primary' : 'outline'}
        onClick={() => void copy()}
        ariaLabel={`Copy ${handle}`}
        style={{ padding: '12px 16px', gap: 6, flexShrink: 0, boxShadow: 'none' }}
      >
        <CopyIcon done={state === 'copied'} />
        <span aria-live="polite">{state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy'}</span>
      </Button>
    </div>
  );
}

function QrCode({ src, size }: { src: string; size: number }) {
  return (
    <figure style={{ margin: 0, width: size, textAlign: 'center' }}>
      <div
        style={{
          position: 'relative',
          width: size,
          height: Math.round(size * (552 / 516)),
          background: '#fff',
          borderRadius: 'var(--mr-radius-md)',
          border: '1px solid var(--mr-hairline)',
          overflow: 'hidden',
        }}
      >
        <Image
          src={src}
          alt="InstaPay QR code for this shop"
          fill
          sizes={`${size}px`}
          unoptimized={isRemote(src)}
          style={{ objectFit: 'contain', padding: 6 }}
        />
      </div>
      <figcaption style={{ ...BODY, fontSize: 'var(--mr-text-xs)', marginTop: 'var(--mr-sp-2)' }}>
        Scan with your phone
      </figcaption>
    </figure>
  );
}

function ExampleReceipt({ src }: { src: string }) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);

  const open = () => {
    const dialog = dialogRef.current;
    if (dialog && typeof dialog.showModal === 'function') dialog.showModal();
  };
  const close = () => dialogRef.current?.close();

  return (
    <>
      <div style={{ display: 'flex', gap: 'var(--mr-sp-4)', alignItems: 'flex-start' }}>
        <button
          type="button"
          onClick={open}
          aria-label="Enlarge the example receipt"
          style={{
            position: 'relative',
            flexShrink: 0,
            width: 72,
            height: 156,
            padding: 0,
            border: '1px solid var(--mr-border)',
            borderRadius: 'var(--mr-radius-md)',
            overflow: 'hidden',
            background: 'var(--mr-cream-200)',
            cursor: 'zoom-in',
            boxShadow: 'var(--mr-shadow-xs)',
          }}
        >
          <Image
            src={src}
            alt=""
            fill
            sizes="72px"
            unoptimized={isRemote(src)}
            style={{ objectFit: 'cover', objectPosition: 'top' }}
          />
        </button>
        <div style={{ minWidth: 0 }}>
          <p style={BODY}>
            Take a screenshot of the <strong style={{ color: 'var(--mr-fg-2)', fontWeight: 500 }}>Approved Transaction</strong>{' '}
            screen. It must show the amount, the reference number and our handle as the recipient.
          </p>
          <button
            type="button"
            onClick={open}
            style={{
              marginTop: 'var(--mr-sp-3)',
              padding: '6px 0',
              background: 'none',
              border: 'none',
              borderBottom: '1px solid var(--mr-gold-400)',
              fontFamily: 'var(--mr-font-label)',
              fontSize: 11,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--mr-ink-900)',
              cursor: 'zoom-in',
            }}
          >
            See the example
          </button>
        </div>
      </div>

      <dialog
        ref={dialogRef}
        aria-label="Example InstaPay receipt"
        onClick={(e) => {
          // A click on the backdrop lands on the dialog itself.
          if (e.target === e.currentTarget) close();
        }}
        style={{
          // Tailwind's preflight zeroes a dialog's margin, which pins it top-left.
          margin: 'auto',
          padding: 0,
          border: 'none',
          borderRadius: 'var(--mr-radius-lg)',
          background: 'var(--mr-cream-100)',
          boxShadow: 'var(--mr-shadow-xl)',
          maxWidth: 'min(92vw, 420px)',
          maxHeight: '92vh',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '92vh' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 'var(--mr-sp-3) var(--mr-sp-3) var(--mr-sp-3) var(--mr-sp-5)',
              borderBottom: '1px solid var(--mr-hairline)',
            }}
          >
            <span style={LABEL}>Example receipt</span>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              style={{
                width: 40,
                height: 40,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'none',
                border: 'none',
                borderRadius: 'var(--mr-radius-pill)',
                color: 'var(--mr-ink-900)',
                cursor: 'pointer',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden style={{ display: 'block' }}>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <div style={{ overflowY: 'auto', background: 'var(--mr-cream-200)' }}>
            <Image
              src={src}
              alt="An approved InstaPay transfer: the amount, the sender, the recipient handle and the reference number"
              width={590}
              height={1280}
              sizes="420px"
              unoptimized={isRemote(src)}
              style={{ display: 'block', width: '100%', height: 'auto' }}
            />
          </div>
        </div>
      </dialog>
    </>
  );
}

export interface InstapayGuideProps {
  guide: Guide | null;
  /** The formatted total, or `null` while it is still being worked out. */
  amount: React.ReactNode | null;
  amountNote?: string;
}

export default function InstapayGuide({ guide, amount, amountNote }: InstapayGuideProps) {
  const { mobile } = useBreakpoint();

  return (
    <section
      aria-label="How to pay with InstaPay"
      style={{
        marginTop: 'var(--mr-sp-5)',
        background: 'var(--mr-cream-100)',
        border: '1px solid var(--mr-hairline)',
        borderRadius: 'var(--mr-radius-lg)',
        boxShadow: 'var(--mr-shadow-sm)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: mobile ? 'var(--mr-sp-5)' : 'var(--mr-sp-5) var(--mr-sp-6)',
          borderBottom: '1px solid var(--mr-hairline)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          columnGap: 'var(--mr-sp-4)',
          rowGap: 'var(--mr-sp-1)',
        }}
      >
        <span style={LABEL}>Amount to send</span>
        <span
          data-testid="instapay-amount"
          aria-busy={amount === null}
          style={{
            fontFamily: 'var(--mr-font-serif)',
            fontSize: 'var(--mr-text-2xl)',
            fontWeight: 500,
            lineHeight: 1.1,
            color: 'var(--mr-fg)',
            fontVariantNumeric: 'lining-nums tabular-nums',
          }}
        >
          {amount ?? <span style={{ color: 'var(--mr-fg-4)' }}>…</span>}
        </span>
        {amountNote && (
          <p style={{ ...BODY, fontSize: 'var(--mr-text-xs)', color: 'var(--mr-fg-4)', flexBasis: '100%' }}>
            {amountNote}
          </p>
        )}
      </div>

      <ol
        style={{
          listStyle: 'none',
          margin: 0,
          padding: mobile ? 'var(--mr-sp-5)' : 'var(--mr-sp-6)',
          display: 'grid',
          gap: 'var(--mr-sp-6)',
        }}
      >
        <Step n={1} title="Send it with InstaPay">
          {guide ? (
            <div
              style={{
                display: 'flex',
                gap: 'var(--mr-sp-5)',
                alignItems: 'flex-start',
              }}
            >
              <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 'var(--mr-sp-4)' }}>
                <Button
                  href={guide.payLink}
                  target="_blank"
                  prefetch={false}
                  testId="instapay-pay-link"
                  style={{ width: '100%' }}
                >
                  Pay with InstaPay
                  <ExternalIcon />
                </Button>
                <div style={{ display: 'grid', gap: 'var(--mr-sp-2)' }}>
                  <span style={{ ...BODY, fontSize: 'var(--mr-text-xs)' }}>
                    Or send to this handle in your InstaPay app
                  </span>
                  <HandleRow handle={guide.handle} />
                </div>
                {mobile && (
                  <details>
                    <summary
                      style={{
                        ...BODY,
                        fontSize: 'var(--mr-text-xs)',
                        cursor: 'pointer',
                        color: 'var(--mr-fg-2)',
                      }}
                    >
                      Paying from another device? Show the QR code
                    </summary>
                    <div style={{ marginTop: 'var(--mr-sp-3)' }}>
                      <QrCode src={guide.qrUrl} size={168} />
                    </div>
                  </details>
                )}
              </div>
              {!mobile && <QrCode src={guide.qrUrl} size={132} />}
            </div>
          ) : (
            <div
              aria-busy
              aria-label="Loading payment details"
              style={{
                height: 106,
                borderRadius: 'var(--mr-radius-md)',
                background: 'var(--mr-cream-200)',
              }}
            />
          )}
        </Step>

        <Step n={2} title="Screenshot the confirmation">
          <ExampleReceipt src={guide?.exampleUrl ?? DEFAULT_INSTAPAY_GUIDE.exampleUrl} />
        </Step>

        <Step n={3} title="Upload it below">
          <p style={BODY}>We check every transfer by hand, then confirm your order by email.</p>
        </Step>
      </ol>
    </section>
  );
}
