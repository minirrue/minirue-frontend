'use client';

import React, { useEffect, useRef, useState } from 'react';
import Wordmark from '@/components/ui/Wordmark';
import PaymentBadge from '@/components/ui/PaymentBadge';
import SocialIcon from '@/components/ui/SocialIcon';
import { useBreakpoint } from '@/lib/hooks/useBreakpoint';
import { TextEffect } from '@/components/core/text-effect';
import type { FooterConfig } from '@/lib/api/storefront';

/**
 * Ebneely maker's-mark — the owner's requirement, verbatim: "before the
 * footer, not inside footer or after footer". Rendered here, as a sibling
 * immediately before the `<footer>` element itself, so it is included by
 * every call site that renders the Footer component (directly or via
 * `FooterWithSettings`) with ONE edit rather than one per page — the same
 * reasoning that put the sticky-vs-fixed fix in this file instead of at
 * each call site.
 *
 * Placement layer: this sits inside the curtain wrapper (same as `<footer>`),
 * so it belongs to the revealed layer, not the scrolling page layer — it is
 * uncovered by the same curtain motion as the footer and always appears
 * immediately above it, never scrolling independently of it.
 * It shares the footer's ink background so the two read as one band; the
 * line itself stays deliberately quiet (small, low-contrast, generous
 * tracking, the same label typography the nav links use) so it never
 * competes with the MiniRue wordmark centred below it.
 */
/**
 * Owner request (2026-07-31): the footer's vertical rhythm used to be four
 * different hand-tuned clamps (newsletter margin, columns-grid marginTop,
 * socials marginTop, bottom-bar marginTop) that merely happened to be close
 * to one another — which is exactly why the gaps read as uneven. Every
 * inter-section gap now comes from this ONE constant, so the rhythm is
 * identical by construction, not by four numbers that happen to agree.
 * Covered by the "single shared gap" test in __tests__/layout/footer.test.tsx
 * so a future edit can't quietly fork it back into four values.
 */
const FOOTER_SECTION_GAP = 'clamp(24px, 4vw, 40px)';

/**
 * The curtain — restored to the footer that shipped before September (#57).
 * =========================================================================
 * The owner's effect, verbatim: "we want the outer reveal under the webpage" —
 * the footer sits BEHIND the page, and the page slides up and off it.
 *
 * This is the pre-September footer, and the declaration below is the one it
 * had: `position: sticky; bottom: 0`, in normal document flow, rendered AFTER
 * `.mr-page-sheet` at every call site. Nothing is measured into `body`,
 * nothing is written to it, and there is no reserved band — the September
 * machinery that did all three is deleted, not patched.
 *
 * WHY IT BROKE, AND WHY IT WAS NEVER THE FOOTER'S FAULT
 * -----------------------------------------------------
 * That footer relied on ONE line elsewhere:
 * `.mr-page-sheet { position: relative; z-index: 1 }`. The page out-ranked the
 * footer, so the footer painted behind it and was uncovered as the page
 * scrolled up off it. `00cd9ec` (#25) removed that line to fix #6 — a stacking
 * context on the page sheet seals the mobile nav sheet (60), the search sheet
 * (120), `MobileSheet` (60) and the review lightbox (70) under the
 * root-mounted bottom nav (20) — and with it went the only thing holding the
 * footer down. Four rewrites of THIS file followed, each fixing a symptom of a
 * change in a different file:
 *
 *   1. `fixed; bottom: 0` + a `ResizeObserver` writing `document.body.style.
 *      paddingBottom` — once the footer grew taller than the viewport its own
 *      top edge was pinned off screen and the wordmark was unreachable.
 *   2. `sticky; bottom: 0; z-index: 0` rendered after the sheet — measured on
 *      a Pixel 5: a 697px footer pinned across an 851px viewport with 2465px
 *      of page still scrolling underneath it, all of it unclickable. Without
 *      the sheet's `z-index: 1` the two tied at 0 and the footer won on tree
 *      order, being the later sibling.
 *   3. `sticky; z-index: -1` — corrected the painting and broke hit testing
 *      with it. Every footer link rendered perfectly and did nothing.
 *   4. a `fixed`/`absolute` curtain rendered BEFORE the sheet (#48/#54) — the
 *      reveal worked and the links worked, but it put the footer ahead of the
 *      whole page in the DOM (so keyboard and screen-reader order hit it
 *      first), reserved its band by writing `--mr-footer-h` into `body`'s
 *      padding on every resize, and had to pick between two positions from a
 *      viewport measurement that a mobile toolbar moves (#50).
 *
 * WHAT REPLACED THE LINE THAT WAS REMOVED
 * ---------------------------------------
 * `.mr-page-sheet` still declares no z-index and must not — see
 * __tests__/layout/page-sheet-stacking.test.ts. The page's precedence over the
 * footer comes instead from `.mr-app-layer` in app/layout.tsx: ONE stacking
 * context wrapped around the whole application, page and root-mounted overlays
 * together, so every z-index in the app still resolves against every other one
 * and nothing is sealed.
 *
 * Inside that layer the footer sits at `z-index: -1`, and THAT is what makes
 * attempt (3) safe now where it was fatal then. A negative-z-index box paints
 * above its stacking context's own background and below that context's in-flow
 * content. In the ROOT context that meant `body` — whose background box paints
 * at the in-flow step — swallowed every pointer event aimed at the footer.
 * Scoped to `.mr-app-layer`, the whole layer paints above `body`, the layer's
 * own box is transparent and paints below its negative child, and the footer
 * takes its own clicks. Verified the only way that counts: `document.
 * elementFromPoint` at each link's own coordinates, then a real pointer click.
 *
 * THE ONE THING THE PRE-SEPTEMBER FOOTER GOT WRONG
 * ------------------------------------------------
 * A sticky box pinned by `bottom: 0` that is TALLER than the scrollport keeps
 * its top edge above the viewport for the whole scroll, including at the end
 * of the document — failure (1), reached by a different road. The footer is
 * ~745px on a 390px-wide phone and plenty of phones are shorter than that, so
 * the case is real and needs the one guard below.
 *
 * `data-curtain="flow"` drops the stickiness and nothing else: the footer
 * stays exactly where it already is in normal flow, as an ordinary last block,
 * and every pixel of it can be scrolled to. Because both states are in flow,
 * the document height and the footer's flow position are IDENTICAL in each —
 * switching cannot move the page under the reader, which is precisely what the
 * previous `fixed`/`absolute` pair did (it toggled `body`'s padding band too).
 *
 * THE GUARD MUST NOT FLIP MID-SCROLL (#50)
 * ----------------------------------------
 * The measurement is taken against the SMALL viewport (`100svh`, the height
 * with the browser chrome VISIBLE) rather than the live `window.innerHeight`,
 * and the decision is asymmetric with a dead band wider than any mobile
 * toolbar. iOS Safari and Chrome Android collapse and expand their toolbars
 * while you scroll, moving `innerHeight` by 60-100px; a 745px footer on a
 * phone that runs between 727px and 807px genuinely has a different answer
 * depending on where the toolbar happens to be. `svh` is constant across a
 * toolbar collapse by definition; the dead band stops the decision oscillating
 * around the boundary when the measurement is noisy. Demotion is immediate (an
 * unreachable footer is a correctness bug); promotion needs headroom to spare.
 *
 * Covered by __tests__/layout/footer-stacking.test.ts, the placement audit in
 * __tests__/layout/footer.test.tsx, and
 * e2e/storefront/mobile-scroll-stability.spec.ts.
 */

/**
 * The headroom `flow` must gain before it is allowed back to `stuck`. Wider
 * than any mobile browser's toolbar (Chrome Android's is 56dp, Safari's bottom
 * bar comparable; the issues quote a 60-100px band), so nothing a toolbar does
 * can push the measurement across it in either direction.
 */
const TOOLBAR_DEAD_BAND_PX = 120;

/**
 * The height of the SMALL viewport — the scrollport with the browser's chrome
 * showing — in CSS pixels.
 *
 * There is no JS property for this (`innerHeight` is the LIVE height, which is
 * the whole problem), so it is read the only way it can be: by asking the
 * engine to resolve `100svh` on a throwaway element. Zero-width, hidden and
 * `position: fixed`, so it neither paints, nor takes a hit test, nor
 * contributes to the document's scrollable area.
 *
 * `Math.min` with `innerHeight` is the degradation path, and it degrades the
 * safe way: an engine that doesn't understand `svh` resolves the height to 0
 * and we fall through to `innerHeight`, while an engine that does can never
 * report a small viewport LARGER than the live one.
 */
function readSmallViewportHeight(): number {
  if (typeof window === 'undefined') return 0;
  const live = window.innerHeight;
  if (typeof document === 'undefined' || !document.body) return live;
  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText =
    'position:fixed;top:0;left:0;width:0;height:100svh;visibility:hidden;pointer-events:none;';
  document.body.appendChild(probe);
  const measured = Math.floor(probe.getBoundingClientRect().height);
  probe.remove();
  // jsdom has no layout engine, so `measured` is 0 there and every unit test
  // keeps comparing against `innerHeight` exactly as it did before.
  return measured > 0 ? Math.min(measured, live) : live;
}

/**
 * The ONLY thing this hook still decides: whether the footer is short enough
 * to be pinned. It writes no CSS custom property, touches no `body` style and
 * reserves no band — the footer is in normal flow and carries its own height,
 * which is the entire point of going back to `sticky`.
 */
function useFooterCurtain() {
  const ref = useRef<HTMLDivElement>(null);
  /**
   * Optimistic: the reveal is the point, and it is correct on every viewport
   * the footer fits in. The measurement below demotes it inside the first
   * effect if it does not fit — long before a shopper could have scrolled to
   * the bottom of the page to see it.
   */
  const [stuck, setStuck] = useState(true);
  const smallViewportH = useRef(0);
  const measuredAtWidth = useRef(-1);
  const measuredAtHeight = useRef(-1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    /**
     * The cache is the second line of defence, and it is what makes this hold
     * even in an engine with no `svh` support at all. A toolbar collapse
     * changes the viewport's HEIGHT ONLY and by less than the dead band, so it
     * re-uses the cached reading and reaches the same verdict. A genuine
     * layout change — a rotation, a window drag, a split screen — changes the
     * width, or the height by more than any toolbar could, and re-probes. It
     * is also a performance guard: appending the probe forces a synchronous
     * layout, and Chrome Android fires a resize storm for the whole duration
     * of the toolbar animation.
     */
    const stableViewportHeight = () => {
      const width = window.innerWidth;
      const live = window.innerHeight;
      if (
        smallViewportH.current <= 0 ||
        width !== measuredAtWidth.current ||
        Math.abs(live - measuredAtHeight.current) > TOOLBAR_DEAD_BAND_PX
      ) {
        measuredAtWidth.current = width;
        measuredAtHeight.current = live;
        smallViewportH.current = readSmallViewportHeight();
      }
      return smallViewportH.current;
    };

    const measure = () => {
      const height = Math.ceil(el.getBoundingClientRect().height);
      const viewport = stableViewportHeight();
      setStuck((wasStuck) =>
        wasStuck ? height <= viewport : height <= viewport - TOOLBAR_DEAD_BAND_PX,
      );
    };

    measure();

    const observer =
      typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    observer?.observe(el);
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, []);

  return { ref, stuck };
}


function EbneelySignature() {
  const year = new Date().getFullYear();
  return (
    <div
      style={{
        background: 'var(--mr-ink-900)',
        textAlign: 'center',
        padding: '14px 20px 0',
      }}
    >
      <TextEffect
        as="span"
        per="char"
        preset="fade"
        style={{
          fontFamily: 'var(--mr-font-label, Jost, sans-serif)',
          fontSize: 'var(--mr-text-xs, 10px)',
          letterSpacing: '0.24em',
          textTransform: 'uppercase',
          color: 'var(--mr-ink-400)',
          opacity: 0.65,
        }}
      >
        {`Powered by Ebneely · © ${year} All rights reserved`}
      </TextEffect>
    </div>
  );
}

export default function Footer({
  config,
  shopName,
}: {
  config: FooterConfig;
  /**
   * The ONE admin-editable shop name (2026-07-31 owner ask) — every caller
   * passes its already-fetched `chrome.shopName`. `undefined` falls back to
   * Wordmark's own "MiniRue" default, so existing callers/tests are
   * unaffected.
   */
  shopName?: string;
}) {
  const { mobile } = useBreakpoint();
  const { ref: curtainRef, stuck } = useFooterCurtain();

  return (
    /*
      The curtain wrapper — the thing that is positioned, so that `<footer>`
      itself stays an ordinary box (no position, no z-index, no insets: see
      __tests__/layout/footer-stacking.test.ts, which still enforces that).
      The Ebneely signature has to be inside it: it is the band immediately
      above the wordmark and shares the footer's ink ground, so the two are
      revealed as one piece. Left outside, it would stay in the scrolling page
      layer and the page would slide up over it.

      The height is measured from THIS element for the same reason: what has to
      fit the viewport is everything being revealed, not just `<footer>`.
    */
    <div
      ref={curtainRef}
      className="mr-footer-curtain"
      data-curtain={stuck ? 'stuck' : 'flow'}
    >
      <EbneelySignature />
      <footer
        data-mr-surface="ink"
        style={{
          // DELIBERATELY UNPOSITIONED, and it must stay that way: no
          // `position`, no `zIndex`, no `top`/`bottom`/`left`/`right`.
          //
          // Every one of the failed attempts put the positioning HERE, on the
          // <footer> itself, and then had to settle the fight with
          // `.mr-page-sheet` with a number in the ROOT stacking context, where
          // both possible answers are bugs: `0` put the footer over the page
          // (it wins a tie on tree order, being the later sibling) and `-1`
          // made every link in it unclickable (in the root context `body`'s own
          // background box paints above a negative-z-index box and takes the
          // pointer events, so "About" rendered and did nothing).
          //
          // The positioning lives on the curtain WRAPPER around this element,
          // and its z-index is resolved inside `.mr-app-layer` (app/layout.tsx)
          // rather than against `body` — which is what makes the pre-September
          // arrangement work again. See the long note above `useFooterCurtain`,
          // and __tests__/layout/footer-stacking.test.ts, which fails if any of
          // these properties reappear on this style object.
          background: 'var(--mr-ink-900)',
          color: 'var(--mr-cream-100)',
          // Fluid padding: generous on desktop, compact on phones so the whole
          // footer stays short enough for the reveal to show its top (the logo).
          // Owner request (2026-07-31): the old constants here (72px top /
          // 44px bottom) were the dead space under the link columns the
          // owner was pointing at — tightened, top and bottom. Bottom padding
          // still carries the home-indicator safe area — this was flagged
          // (with ChatButton.tsx) as fixed-positioned chrome with no
          // safe-area padding; `viewport-fit: cover` on the root viewport
          // export (app/layout.tsx) is what makes the env() call resolve —
          // only the constant part shrank, the env() term is untouched.
          paddingTop: 'clamp(24px, 4vw, 48px)',
          paddingLeft: 'clamp(20px, 5vw, 48px)',
          paddingRight: 'clamp(20px, 5vw, 48px)',
          paddingBottom: 'calc(clamp(12px, 2vw, 24px) + env(safe-area-inset-bottom))',
        }}
      >
      <div style={{ maxWidth: 1280, margin: '0 auto', textAlign: 'center' }}>
        {/*
          Task 15d (2026-07-30): wordmark left, InstaPay/Visa/Mastercard right,
          one row — replacing the old centred wordmark plus its own
          standalone payment-marks row (deleted below, along with the
          vertical space it carried). `flex-wrap` + `gap` rather than a fixed
          full-width row so the two still fit if the smallest breakpoint
          genuinely can't share a line — see the project rule against masking
          overflow with a clip.
        */}
        <div
          data-testid="footer-brand-row"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
            textAlign: 'left',
          }}
        >
          <div data-testid="footer-wordmark">
            <Wordmark
              size={mobile ? 26 : 38}
              color="var(--mr-cream-100)"
              captionColor="var(--mr-ink-400)"
              text={shopName}
            />
          </div>
          <div
            data-testid="footer-payments"
            style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}
          >
            {config.paymentBadges.map((b) => (
              <PaymentBadge key={b} badge={b} />
            ))}
          </div>
        </div>
        {config.newsletterEnabled && (
          <div
            data-testid="footer-newsletter"
            style={{ maxWidth: 460, margin: `${FOOTER_SECTION_GAP} auto 0` }}
          >
            <div
              style={{
                fontFamily: 'Jost, sans-serif',
                fontSize: 10,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                marginBottom: 16,
                color: 'var(--mr-gold-300)',
              }}
            >
              {config.newsletterEyebrow}
            </div>
            <p
              style={{
                fontFamily: 'Cormorant Garamond, serif',
                fontStyle: 'italic',
                fontSize: 20,
                lineHeight: 1.4,
                color: 'var(--mr-cream-200)',
                margin: '0 0 24px',
              }}
            >
              {config.newsletterBlurb}
              {config.tagline ? ` ${config.tagline}` : ''}
            </p>
            <form
              className="mr-underline-input"
              style={{
                display: 'flex',
                paddingBottom: 8,
                gap: 12,
                alignItems: 'center',
                borderBottom: '1px solid rgba(238,230,209,.2)',
              }}
              onSubmit={(e) => e.preventDefault()}
            >
              <input
                placeholder="you@address.com"
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 0,
                  color: 'var(--mr-cream-100)',
                  fontFamily: 'Inter Tight, sans-serif',
                  fontSize: 14,
                  padding: '8px 0',
                  outline: 'none',
                }}
              />
              <button
                style={{
                  background: 'none',
                  border: 0,
                  color: 'var(--mr-gold-300)',
                  cursor: 'pointer',
                  fontFamily: 'Jost, sans-serif',
                  fontSize: 10,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  transition: 'color 200ms var(--mr-ease-out)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--mr-gold-500)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--mr-gold-300)')}
              >
                Subscribe <span className="mr-link-arrow">→</span>
              </button>
            </form>
          </div>
        )}

        <div
          data-testid="footer-columns"
          style={{
            display: 'grid',
            gridTemplateColumns: mobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)',
            gap: 'clamp(20px, 3vw, 44px)',
            marginTop: FOOTER_SECTION_GAP,
            textAlign: 'left',
          }}
        >
          {config.columns.map((c) => (
            <div key={c.id}>
              <div
                style={{
                  fontFamily: 'Jost, sans-serif',
                  fontSize: 9,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--mr-gold-300)',
                  marginBottom: 12,
                }}
              >
                {c.title}
              </div>
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                {c.links.map((link) => (
                  <li key={link.id}>
                    <a
                      href={link.href}
                      className="mr-nav-link"
                      style={{
                        fontFamily: 'Inter Tight, sans-serif',
                        fontSize: 13,
                        color: 'var(--mr-cream-200)',
                        opacity: 0.75,
                        textDecoration: 'none',
                      }}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/*
          Task 15d: payment badges moved up into the brand row above, so this
          is socials only now — no more mobile/desktop split, since that
          split existed purely to fit the payment badges in alongside them.
        */}
        <div
          data-testid="footer-socials"
          style={{
            marginTop: FOOTER_SECTION_GAP,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: mobile ? 'center' : 'flex-start',
            gap: 14,
          }}
        >
          {config.socials.map((s) => (
            <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer"
              style={{ color: 'var(--mr-cream-200)', opacity: 0.75, display: 'inline-flex' }}>
              <SocialIcon network={s.network} />
            </a>
          ))}
        </div>

        {/*
          Task 6: a genuinely readable brand sentence — normal contrast (full
          --mr-cream-200, the same colour the newsletter blurb reads at), normal
          body size, in normal document flow. Not the low-contrast maker's-mark
          treatment above (EbneelySignature) and not config.legalLine below,
          which is admin-authored and empty by default (see FALLBACK_CHROME in
          lib/api/storefront.ts) — this line ships in the bundle, so it renders
          on every page regardless of what the backend returns. One sentence,
          the register every maison site prints near its footer, carrying the
          spaced "Mini Rue" alongside "MiniRue" the way people actually search.
        */}
{/*
          The hardcoded "MiniRue (Mini Rue) — an independent maison…" line was
          removed on the owner's instruction (2026-07-31). It existed to put the
          spaced "Mini Rue" into visible copy for search, but it also hardcoded
          the shop name in a footer that must now read from the single Settings
          field, and the owner does not want the sentence on the page.

          If the spaced-name mention is wanted again, it belongs in the
          admin-authored `config.legalLine` below — DB-driven, editable, and
          already rendered — not baked into the bundle.
        */}
        <div
          data-testid="footer-bottom-bar"
          style={{
            marginTop: FOOTER_SECTION_GAP,
            paddingTop: 'clamp(12px, 1.5vw, 20px)',
            borderTop: '1px solid rgba(238,230,209,.1)',
            display: 'flex',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
            fontFamily: 'Inter Tight, sans-serif',
            fontSize: 11,
            color: 'var(--mr-ink-400)',
          }}
        >
          {/*
            The spaced "Mini Rue" is deliberate and load-bearing, not a typo. Google's own guidance
            is "make sure your site includes the words people would type." Users search "mini rue
            shop" / "mini rue store", but the spaced form previously appeared NOWHERE in visible
            copy — only in <title> and JSON-LD. Structured data alone does not fully substitute for
            the words existing as readable text on the page. One natural mention in the footer, on
            every page, is the honest way to close that gap. This span is wired to the DB-driven
            FooterConfig.legalLine — but that field is admin-authored and empty by default
            (FALLBACK_CHROME.footer.legalLine === '' in lib/api/storefront.ts), so until an admin
            fills it in, this span is a no-op and renders nothing. The guaranteed spaced mention is
            the hardcoded "footer-maison-line" block above, added for that reason. Keep this comment
            so nobody "fixes" the spelling away if/when an admin does set legalLine.
          */}
          <span>{config.legalLine}</span>
          <span>{config.secondaryLine}</span>
        </div>
      </div>
      </footer>
    </div>
  );
}
