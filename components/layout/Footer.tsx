'use client';

import React from 'react';
import Wordmark from '@/components/ui/Wordmark';
import PaymentBadge from '@/components/ui/PaymentBadge';
import SocialIcon from '@/components/ui/SocialIcon';
import { useBreakpoint } from '@/lib/hooks/useBreakpoint';
import { TextEffect } from '@/components/core/text-effect';
import { type FooterConfig } from '@/lib/api/storefront';
import { usePreviewId } from '@/lib/hooks/storefront-preview';

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
 * The curtain — the footer that shipped before September (#57, #68).
 * ==================================================================
 * Owner's effect, verbatim: "we want the outer reveal under the webpage" — the
 * footer sits BEHIND the page and the page slides up and off it. Not a block
 * underneath it: "revealed under the webpage, not vertical under it".
 *
 * The whole arrangement is three CSS declarations on the wrapper and nothing
 * else:
 *
 *     .mr-footer-curtain { position: sticky; bottom: 0; z-index: -1 }
 *
 * plus `.mr-app-layer { position: relative; z-index: 1 }` around the page and
 * the root-mounted overlays, so the page out-ranks the footer while every
 * overlay keeps its rank relative to every other.
 *
 * ## No JavaScript. That is the design, not an omission.
 *
 * This file briefly carried a `ResizeObserver`, a `100svh` probe element, a
 * `document.fonts.ready` wait and a `data-curtain` state that swapped the
 * wrapper between `sticky` and `static`. All of it existed to answer one
 * question — "is the footer taller than the viewport?" — and to fall back to
 * `position: static` when it was.
 *
 * That fallback is what the owner was reporting. The footer is ~748px, so on a
 * Pixel 5 (727px), an iPhone 12 (664px) and a 1440x720 laptop it answered YES
 * and dropped the stickiness — which is precisely "vertical under it" rather
 * than revealed. Every phone lost the effect, and so did any short laptop.
 *
 * The fallback was guarding a real property of `position: sticky` — a box
 * pinned by `bottom: 0` that is taller than the scrollport holds its own top
 * edge above the viewport while it is pinned. But it un-sticks on reaching its
 * flow position at the end of the document, which is exactly where the reveal
 * finishes, so the top is reachable anyway. The pre-September footer had no
 * such guard and worked; adding one traded the effect for a problem that does
 * not occur.
 *
 * ## If the reveal ever needs the footer to fit the viewport
 *
 * Shorten the FOOTER, not the mechanism. It is ~748px against a 664px iPhone
 * viewport — an 84px difference, which is a spacing decision. Reaching for JS
 * to detect the overflow is how this file grew a scroll listener, a resize
 * observer and a font-loading race in the first place.
 */


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
  // Draft-preview tag (#193); undefined, so absent, on the live shop.
  const previewId = usePreviewId('footer');

  /*
   * The footer renders exactly the columns the dashboard configured — nothing
   * is injected here.
   *
   * An earlier version appended a 'Help' column of hardcoded trust links
   * (Shipping, Returns, Contact, About) because the live footer is a single
   * 'Service' column holding one auth-gated '/account/orders' link, and those
   * four pages answer 200 while being linked from nowhere in the app. The
   * links were removed on the owner's instruction, 2026-09-21: navigation is
   * content and must be dynamically controlled from the dashboard, not frozen
   * into storefront source where the owner cannot rename, reorder or remove it
   * and where it rots silently the day a page is unpublished.
   *
   * The orphaned-pages problem is real and is being solved where it belongs:
   * in the dashboard's FooterEditor/NavbarEditor, which already write these
   * settings.
   */
  const columns = config.columns;

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
    <div className="mr-footer-curtain" data-preview-id={previewId}>
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
        {/* #144: the newsletter signup is gone. Its form only called
            preventDefault — the backend has no newsletter list — so a visitor
            who typed an email got silence. It stays out, whatever the
            dashboard's newsletterEnabled toggle says, until there is somewhere
            real to send the address. */}
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
          {columns.map((c) => (
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
