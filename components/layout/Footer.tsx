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
 * The curtain.
 * ============
 * The owner's effect, verbatim: "we want the outer reveal under the webpage" —
 * the footer sits BEHIND the page, and the page slides up and off it.
 *
 * Mechanically that means exactly one thing: the footer has to be PAINTED
 * somewhere other than where it sits in flow, which only `fixed` / `sticky` can
 * do. An unpositioned box cannot overlap anything, so it cannot be revealed
 * from under anything either — that is why the static footer that shipped last
 * has no reveal at all, rather than a broken one.
 *
 * Once the footer is positioned it is competing with `.mr-page-sheet`
 * (`position: relative`) for paint order, and THAT is what the previous three
 * attempts each lost:
 *
 *   1. `fixed; bottom: 0` — right idea, but the footer was rendered AFTER the
 *      sheet, so it painted on top of it; and it needed a `ResizeObserver`
 *      writing `document.body.style.paddingBottom` to fake in-flow height. Once
 *      the footer grew taller than the viewport its own top edge was pinned off
 *      screen and the wordmark on it was unreachable.
 *   2. `sticky; bottom: 0; z-index: 0` — same paint bug, measured: a 697px
 *      footer pinned across an 851px viewport with 2465px of page still
 *      scrolling underneath it. `sticky` is a POSITIONED value, so it painted
 *      above every in-flow box whatever the DOM order, and at `z-index: 0` it
 *      tied with the sheet and won the tie on tree order, being the later
 *      sibling. The curtain ran backwards.
 *   3. `sticky; z-index: -1` — corrected the painting and broke hit testing. A
 *      negative-z-index box is behind in-flow content for POINTER EVENTS too,
 *      so every footer link rendered perfectly and did nothing.
 *
 * The fix is tree order, not z-index. Two positioned boxes that both have
 * `z-index: auto` paint in DOCUMENT ORDER, so this curtain is rendered BEFORE
 * `.mr-page-sheet` at every call site: the sheet is the later sibling, so the
 * sheet paints over it, and there is no z-index — and therefore no stacking
 * context, and therefore no overlay sealed inside one (see the long note on
 * `.mr-page-sheet` in app/styles/mr-tokens.css) — anywhere in the chain.
 * Nothing is negative, so hit testing is ordinary: where the sheet covers the
 * curtain the sheet takes the clicks, and where the sheet has scrolled past it
 * the footer takes its own.
 *
 * Two states, one measurement:
 *
 *   data-curtain="pinned"  (`position: fixed; bottom: 0`)
 *     The reveal. The footer is parked against the bottom of the viewport,
 *     behind the sheet. `--mr-footer-h` becomes `body`'s padding-bottom
 *     (app/globals.css) — the scroll room that lets the sheet's bottom edge
 *     travel up the viewport and uncover it. A CSS custom property, not
 *     `document.body.style.paddingBottom`: the effect that wrote that inline
 *     was deleted for good reason and is not coming back.
 *
 *   data-curtain="flow"  (`position: absolute; bottom: 0`)
 *     The fallback, for a footer TALLER than the viewport. A bottom-anchored
 *     box taller than the scrollport can never show its own top: pinned, its
 *     top is above the viewport; released, you are at the end of the document
 *     looking at its bottom. That is failure (1) exactly, and no amount of
 *     extra scroll room fixes it, because the shortfall is the viewport. So the
 *     curtain stops pretending: absolute against `body` (hence `body {
 *     position: relative }`) puts it in the same reserved band at the true
 *     bottom of the document, where it scrolls like any last block and every
 *     pixel of it is reachable. Same variable, same band; only `position`
 *     differs.
 *
 * Covered by __tests__/layout/footer-stacking.test.ts and the placement audit
 * in __tests__/layout/footer.test.tsx.
 */
const FOOTER_HEIGHT_VAR = '--mr-footer-h';

function useFooterCurtain() {
  const ref = useRef<HTMLDivElement>(null);
  /**
   * Optimistic: the reveal is the point, and it is correct on every viewport
   * the footer fits in. The measurement below demotes it inside the first
   * effect if it does not fit — long before a shopper could have scrolled to
   * the bottom of the page to see it.
   */
  const [pinned, setPinned] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;

    const measure = () => {
      const height = Math.ceil(el.getBoundingClientRect().height);
      // The scroll room the sheet needs in order to have something to uncover.
      root.style.setProperty(FOOTER_HEIGHT_VAR, `${height}px`);
      // `innerHeight`, not svh/dvh: this is a comparison against the real
      // scrollport as it is right now, re-run on resize and orientation change.
      setPinned(height <= window.innerHeight);
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
      // A route that renders no footer must not keep the band reserved.
      root.style.removeProperty(FOOTER_HEIGHT_VAR);
    };
  }, []);

  return { ref, pinned };
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
  const { ref: curtainRef, pinned } = useFooterCurtain();

  return (
    /*
      The curtain wrapper — the thing that is positioned, so that `<footer>`
      itself stays an ordinary box (no position, no z-index, no insets: see
      __tests__/layout/footer-stacking.test.ts, which still enforces that).
      The Ebneely signature has to be inside it: it is the band immediately
      above the wordmark and shares the footer's ink ground, so the two are
      revealed as one piece. Left outside, it would stay in the scrolling page
      layer and the curtain would slide up over it.

      `--mr-footer-h` is measured from THIS element for the same reason: the
      reserved band has to be the height of everything being revealed, not just
      of `<footer>`.
    */
    <div
      ref={curtainRef}
      className="mr-footer-curtain"
      data-curtain={pinned ? 'pinned' : 'flow'}
    >
      <EbneelySignature />
      <footer
        data-mr-surface="ink"
        style={{
          // DELIBERATELY UNPOSITIONED, and it must stay that way: no
          // `position`, no `zIndex`, no `top`/`bottom`/`left`/`right`.
          //
          // Every one of the three failed attempts put the positioning HERE,
          // on the <footer> itself, and then had to pick a z-index to settle
          // the fight with `.mr-page-sheet` — `0` put the footer over the page
          // (it wins a tie on tree order, being the later sibling) and `-1`
          // made every link in it unclickable (a negative-z-index box is behind
          // in-flow content for hit testing too, so "About" rendered and did
          // nothing). The reveal is real again, but it is the curtain WRAPPER
          // around this element that is positioned, and it wins its ordering by
          // being rendered before the sheet rather than by a number. See
          // `useFooterCurtain` above for the whole argument, and
          // __tests__/layout/footer-stacking.test.ts, which fails if any of
          // those properties reappear on this style object.
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
