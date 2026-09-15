import Image from 'next/image';
import Button from '@/components/ui/Button';

/** The shop's Trustpilot profile — the clean address, no tracking params. */
export const TRUSTPILOT_PROFILE_URL = 'https://www.trustpilot.com/review/minirueshop.com';

/** Official wordmark from Trustpilot's brand-assets CDN, served locally so the
 *  badge never waits on (or disappears with) a third-party request. */
const LOGO_SRC = '/brand/trustpilot-logo.svg';
const LOGO_RATIO = 1132.8 / 278.2;

type Variant = 'compact' | 'band';

function VerifiedMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      style={{ flex: 'none', color: 'var(--mr-fg-2)' }}
    >
      <path
        d="M8 1.2 9.6 2.4l2-.1.6 1.9 1.6 1.2-.7 1.9.7 1.9-1.6 1.2-.6 1.9-2 -.1L8 13.6l-1.6-1.2-2 .1-.6-1.9-1.6-1.2.7-1.9-.7-1.9 1.6-1.2.6-1.9 2 .1L8 1.2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <path
        d="m5.6 7.5 1.7 1.7 3.2-3.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ExternalArrow() {
  return (
    <svg aria-hidden="true" viewBox="0 0 12 12" width="11" height="11" style={{ flex: 'none' }}>
      <path
        d="M3.5 8.5 8.5 3.5M4.5 3.5h4v4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The site's own pill Button (owner, 2026-09-15: "the button doesn't follow the
 * same theme as MiniRue"). It was a square hand-rolled outline link; now it's
 * the same shape, type, hover sweep and press as every other CTA.
 */
function ReviewLink({ variant }: { variant: 'outline' | 'primary' }) {
  return (
    <Button
      variant={variant}
      size="md"
      href={TRUSTPILOT_PROFILE_URL}
      target="_blank"
      prefetch={false}
      traceId="EL-LINK-trustpilot-review"
    >
      Review us on Trustpilot
      <ExternalArrow />
      <span className="sr-only">(opens in a new tab)</span>
    </Button>
  );
}

/**
 * "Verified on Trustpilot" trust moment (#156). Static and server-rendered, so
 * it is in the HTML and always shown — no widget script decides whether it
 * appears. Deliberately claims no rating, score or count: the profile has no
 * reviews yet, and Trustpilot's own page is where those will live.
 *
 * - `compact`: a quiet row closing the product reviews section.
 * - `band`: a fuller, centered band on the home page just before the footer.
 */
export default function TrustpilotTrust({ variant }: { variant: Variant }) {
  if (variant === 'compact') {
    const h = 22;
    return (
      <section
        aria-label="Trustpilot"
        data-trace-id="EL-REGION-trustpilot-trust"
        // The negative top margin tucks the row into the reviews section's own
        // generous bottom padding, so it reads as that section's closing line.
        className="-mt-[clamp(16px,6vw,48px)] px-[clamp(20px,5vw,32px)] pb-[clamp(40px,8vw,64px)] lg:px-[clamp(32px,4vw,64px)]"
        style={{ background: 'var(--mr-cream-100)' }}
      >
        <div
          className="flex flex-wrap items-center justify-between gap-x-8 gap-y-5"
          style={{ borderTop: '1px solid var(--mr-hairline)', paddingTop: 28 }}
        >
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <Image src={LOGO_SRC} alt="Trustpilot" width={Math.round(h * LOGO_RATIO)} height={h} />
            <p style={{ margin: 0, fontFamily: 'var(--mr-font-ui)', fontSize: 'var(--mr-text-sm)', lineHeight: 1.5 }}>
              <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--mr-fg)' }}>
                <VerifiedMark />
                Verified business on Trustpilot
              </span>
              <span style={{ display: 'block', color: 'var(--mr-fg-2)' }}>
                Read our reviews or write one.
              </span>
            </p>
          </div>
          <ReviewLink variant="outline" />
        </div>
      </section>
    );
  }

  const h = 30;
  return (
    <section
      aria-labelledby="trustpilot-band-heading"
      data-trace-id="EL-REGION-trustpilot-trust"
      style={{
        background: 'var(--mr-cream-200)',
        borderTop: '1px solid var(--mr-hairline)',
        padding: 'clamp(56px, 10vw, 104px) var(--mr-gutter)',
      }}
    >
      <div className="mx-auto flex max-w-[34rem] flex-col items-center text-center">
        <Image src={LOGO_SRC} alt="Trustpilot" width={Math.round(h * LOGO_RATIO)} height={h} />
        <h2
          id="trustpilot-band-heading"
          style={{
            fontFamily: 'var(--mr-font-serif)',
            fontWeight: 400,
            fontSize: 'clamp(var(--mr-text-xl), 3.2vw, var(--mr-text-2xl))',
            lineHeight: 1.1,
            letterSpacing: '-0.006em',
            color: 'var(--mr-fg)',
            margin: '28px 0 14px',
            textWrap: 'balance',
          }}
        >
          A verified business
        </h2>
        <p
          style={{
            margin: '0 0 32px',
            fontFamily: 'var(--mr-font-ui)',
            fontSize: 'var(--mr-text-base)',
            lineHeight: 1.6,
            color: 'var(--mr-fg-2)',
            textWrap: 'pretty',
          }}
        >
          We are a verified business on Trustpilot. Read what customers say about us, or leave a
          review of your own.
        </p>
        <ReviewLink variant="primary" />
      </div>
    </section>
  );
}
