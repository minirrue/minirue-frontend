'use client';

import React from 'react';
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
 * Placement layer: this sits AFTER `.mr-page-sheet` in the DOM (same as
 * `<footer>`), so it belongs to the revealed layer, not the scrolling page
 * layer — it is uncovered by the same curtain motion as the footer and
 * always appears immediately above it, never scrolling independently of it.
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

  return (
    <>
      <EbneelySignature />
      <footer
        data-mr-surface="ink"
        style={{
          // `fixed` pinned the footer's top edge above the viewport the
          // moment its own content grew taller than the screen — nothing
          // could scroll to it, which is why the wordmark at its top was
          // clipped off. `sticky` behaves identically while the footer
          // fits (pinned to the bottom edge, revealed as the page sheet
          // above it scrolls up over it), but the instant it is taller
          // than the viewport, sticky simply cannot pin something bigger
          // than the scrollport — the browser lets you scroll straight
          // through it instead. The footer now also occupies its own
          // height in normal flow, so the page is naturally that much
          // taller; the old `ResizeObserver` + `document.body.style.
          // paddingBottom` effect existed only to fake that, and it is
          // deleted rather than patched.
          position: 'sticky',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 0,
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
        <div
          data-testid="footer-maison-line"
          style={{
            marginTop: FOOTER_SECTION_GAP,
            maxWidth: 560,
          }}
        >
          <p
            style={{
              margin: 0,
              fontFamily: 'Cormorant Garamond, serif',
              fontStyle: 'italic',
              fontSize: 15,
              lineHeight: 1.5,
              color: 'var(--mr-cream-200)',
              textAlign: 'left',
            }}
          >
            MiniRue (Mini Rue) — an independent maison, shipping original quality perfumes and cosmetics worldwide.
          </p>
        </div>

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
    </>
  );
}
