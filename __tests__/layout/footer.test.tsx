import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import Footer from '@/components/layout/Footer';
import { FALLBACK_CHROME } from '@/lib/api/storefront';
import type { PaymentBadge } from '@/lib/api/storefront';

/**
 * W4a.1 — the footer's root fix, and #57, which reverted it to the footer that
 * shipped before September.
 *
 * The positioning does not live on `<footer>` at all: `fixed`, `sticky` and
 * `sticky; z-index: -1` were each tried on this element, in the ROOT stacking
 * context, and each broke something (the whole history is in
 * __tests__/layout/footer-stacking.test.ts). The curtain WRAPPER is what is
 * positioned, it is `position: sticky; bottom: 0` — the pre-September
 * declaration — and it is ordered under the page by a `z-index: -1` resolved
 * inside `.mr-app-layer` rather than against `body`.
 *
 * What survives here unchanged is the part of W4a.1 that was right: this
 * component writes nothing to `body`. It no longer publishes a measured height
 * either — a sticky footer is in normal flow and carries its own.
 */
describe('Footer position (W4a.1 / #57)', () => {
  it('leaves <footer> itself unpositioned, so it cannot overlap the page', () => {
    /*
     * All three positioned values were tried on this element in production and
     * all three broke: `fixed` clipped the footer's own top edge once it grew
     * taller than the viewport, `sticky` pinned it over the page sheet, and the
     * z-index that was supposed to settle that put its links behind `body` for
     * pointer events. The wrapper is positioned instead.
     */
    render(<Footer config={FALLBACK_CHROME.footer} />);
    const footer = screen.getByRole('contentinfo');
    expect(footer.style.position).toBe('');
    expect(footer.style.bottom).toBe('');
    expect(footer.style.zIndex).toBe('');
  });

  it('renders the curtain wrapper around the whole footer band', () => {
    // The revealed band is the signature + <footer> together, as one box, so
    // the curtain measures and moves them as one.
    const { container } = render(<Footer config={FALLBACK_CHROME.footer} />);
    const curtain = container.querySelector('.mr-footer-curtain');
    expect(curtain).not.toBeNull();
    expect(curtain).toContainElement(screen.getByRole('contentinfo'));
    // `stuck` (the reveal) or `flow` (the taller-than-the-viewport fallback).
    expect(curtain?.getAttribute('data-curtain')).toMatch(/^(stuck|flow)$/);
  });

  it('never writes document.body.style.paddingBottom (the measuring effect is gone)', () => {
    document.body.style.paddingBottom = '';
    const { unmount } = render(<Footer config={FALLBACK_CHROME.footer} />);
    expect(document.body.style.paddingBottom).toBe('');
    unmount();
    expect(document.body.style.paddingBottom).toBe('');
  });

  it('publishes no --mr-footer-h either — the reserved band is gone with it', () => {
    // #48 replaced the inline body style with a custom property feeding
    // `body { padding-bottom }`. A sticky footer is in flow and carries its own
    // height, so there is no band to reserve and nothing to publish.
    const root = document.documentElement;
    root.style.removeProperty('--mr-footer-h');
    const { unmount } = render(<Footer config={FALLBACK_CHROME.footer} />);
    expect(root.style.getPropertyValue('--mr-footer-h')).toBe('');
    unmount();
    expect(root.style.getPropertyValue('--mr-footer-h')).toBe('');
  });

  it('carries the home-indicator safe area in its own bottom padding', () => {
    render(<Footer config={FALLBACK_CHROME.footer} />);
    const footer = screen.getByRole('contentinfo');
    expect(footer.style.paddingBottom).toContain('env(safe-area-inset-bottom)');
  });
});

/**
 * Owner addition, folded into this task: the "Powered by Ebneely" maker's
 * mark, "before the footer, not inside footer or after footer". Rendered as
 * a sibling immediately before `<footer>` in Footer.tsx itself so every call
 * site gets it with one edit — see the comment above `EbneelySignature` there
 * for the full placement reasoning.
 */
describe('Ebneely signature placement', () => {
  it('renders before the <footer> element, not inside it, with a copyright mark', () => {
    const { container } = render(<Footer config={FALLBACK_CHROME.footer} />);
    const footer = screen.getByRole('contentinfo');

    // Not inside <footer>: the signature text must not be a descendant of it.
    expect(footer.textContent).not.toContain('Powered by Ebneely');

    // Present somewhere in the tree, with a copyright mark, and positioned
    // before <footer> in document order.
    const signature = Array.from(container.querySelectorAll('*')).find((el) =>
      el.textContent?.includes('Powered by Ebneely') && el.children.length === 0,
    );
    expect(signature?.textContent).toContain('©');

    const position = footer.compareDocumentPosition(
      container.querySelector('[aria-hidden="true"]') as Node,
    );
    // Node.DOCUMENT_POSITION_PRECEDING (2): the signature's aria-hidden
    // per-char wrapper comes BEFORE <footer> in the document.
    // eslint-disable-next-line no-bitwise
    expect(position & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });
});

/**
 * Structural audit: every module that renders `.mr-page-sheet` and a
 * `<Footer>`/`<FooterWithSettings>` must render the footer AFTER the sheet —
 * outside it, and as the LATER sibling.
 *
 * This flipped back (#57), and the flip is the fix, not a detail.
 *
 * #48 moved the footer ahead of the sheet because at that point document order
 * was the ONLY thing deciding which of the two positioned boxes painted on top:
 * neither declared a z-index, so the later sibling won, and a footer rendered
 * after the sheet painted OVER the page. The cost was that the footer came
 * ahead of the entire page in the DOM on every route — so keyboard order and
 * every screen reader reached the footer before the header and the content.
 *
 * The ordering is no longer won on document order, so that cost is not worth
 * paying. `.mr-app-layer` (app/layout.tsx) is one stacking context around the
 * page AND the root-mounted overlays, and inside it the curtain sits at
 * `z-index: -1` — the page out-ranks the footer wherever the footer sits in the
 * tree. So the footer goes back where it reads correctly: last.
 *
 * Ordering them with a z-index ON `.mr-page-sheet` instead would also work and
 * is deliberately still not done: a stacking context there seals the mobile
 * menu and the search sheet under the bottom nav (see
 * page-sheet-stacking.test.ts). That is exactly why the z-index went one level
 * out rather than back onto the sheet.
 *
 * A full RSC render isn't available in jest (several of these are async Server
 * Components hitting real fetchers), so this follows the same static-source-scan
 * convention `chrome-coverage.test.ts` already uses for "every <Header> usage
 * passes a navbar prop": find where `.mr-page-sheet`'s own `<div>` OPENS in the
 * source text and assert the footer render appears after that point.
 *
 * This scans the whole `app/` and `components/` tree — not a fixed list of
 * files — so a NEW page that renders its footer on the wrong side of the sheet
 * fails this test too, which is the whole point of making it structural.
 */
describe('Footer placement — after .mr-page-sheet, outside it', () => {
  const ROOT = path.resolve(__dirname, '../..');
  const SEARCH_DIRS = ['app', 'components'];

  function listTsxFiles(dir: string): string[] {
    const entries = readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...listTsxFiles(full));
      } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
        files.push(full);
      }
    }
    return files;
  }

  /** Matches an actual `className="mr-page-sheet"` (or `'...'`) attribute —
   *  not just the bare substring, which also shows up in prose comments
   *  (this test file's own subject, Footer.tsx, documents the sticky fix in
   *  a comment that says ".mr-page-sheet" and is correctly NOT part of the
   *  audit: it renders `<footer>`, the element, never `<Footer>`, a JSX
   *  usage of the component). */
  const PAGE_SHEET_CLASS_RE = /className=(["'])[^"']*\bmr-page-sheet\b[^"']*\1/;

  /** Index of the `<div` that OPENS `.mr-page-sheet`. Returns null if the
   *  source doesn't look the way we expect (treated as "couldn't verify" — the
   *  assertion below fails loudly rather than passing vacuously). */
  function mrPageSheetOpenIndex(src: string): number | null {
    const classMatch = PAGE_SHEET_CLASS_RE.exec(src);
    if (!classMatch) return null;
    const tagStart = src.lastIndexOf('<div', classMatch.index);
    return tagStart === -1 ? null : tagStart;
  }

  const files = SEARCH_DIRS.flatMap((d) => listTsxFiles(path.join(ROOT, d)));
  const relevant = files.filter((f) => {
    const src = readFileSync(f, 'utf8');
    return PAGE_SHEET_CLASS_RE.test(src) && /<Footer(?:WithSettings)?[\s/>]/.test(src);
  });

  // Sanity guard: if this list is empty, the scan itself is broken (every
  // page that has a footer today also renders the sheet), which would make
  // every assertion below vacuously pass. Fail loudly instead of silently.
  it('found at least one file to audit', () => {
    expect(relevant.length).toBeGreaterThan(0);
  });

  /** Index of the `</div>` that CLOSES `.mr-page-sheet`, by counting `<div`
   *  against `</div>` from the opening tag. Returns null if the tags don't
   *  balance (treated as "couldn't verify" — the assertion fails loudly rather
   *  than passing vacuously). */
  function mrPageSheetCloseIndex(src: string, openIdx: number): number | null {
    let depth = 0;
    const tag = /<div\b|<\/div>/g;
    tag.lastIndex = openIdx;
    let m: RegExpExecArray | null;
    while ((m = tag.exec(src))) {
      depth += m[0] === '</div>' ? -1 : 1;
      if (depth === 0) return m.index;
    }
    return null;
  }

  it.each(relevant.map((f) => [path.relative(ROOT, f), f] as const))(
    '%s renders its footer after .mr-page-sheet closes, not inside or before it',
    (_label, file) => {
      const src = readFileSync(file, 'utf8');
      const openIdx = mrPageSheetOpenIndex(src);
      expect(openIdx).not.toBeNull();
      const closeIdx = mrPageSheetCloseIndex(src, openIdx as number);
      expect(closeIdx).not.toBeNull();

      const footerMatch = /<Footer(?:WithSettings)?[\s/>]/.exec(src);
      expect(footerMatch).not.toBeNull();

      // Strictly later in the source than the sheet's CLOSING tag, which for
      // sibling JSX is strictly later in the DOM — so the page and its header
      // come first for keyboard and screen-reader order, and "outside it"
      // rather than nested within the sheet.
      expect(footerMatch!.index).toBeGreaterThan(closeIdx as number);
    },
  );
});

/**
 * The other half of the placement rule, for the routes whose `.mr-page-sheet`
 * lives in a CHILD component — the PDP renders `<ProductPageClient>`, which is
 * what owns the sheet, so the audit above cannot see it. The footer still has
 * to be the later sibling there, and #48 moved it ahead of the page on exactly
 * these routes too.
 */
describe('Footer placement — after the page on routes whose sheet is in a child', () => {
  const ROOT = path.resolve(__dirname, '../..');

  const CASES: Array<[string, RegExp]> = [
    ['app/shop/[category]/[product]/page.tsx', /<ProductPageClient[\s/>]/],
  ];

  it.each(CASES)('%s renders its footer after the page component', (rel, pageRe) => {
    const src = readFileSync(path.join(ROOT, rel), 'utf8');
    const pageMatch = pageRe.exec(src);
    const footerMatch = /<Footer(?:WithSettings)?[\s/>]/.exec(src);
    expect(pageMatch).not.toBeNull();
    expect(footerMatch).not.toBeNull();
    expect(footerMatch!.index).toBeGreaterThan(pageMatch!.index);
  });
});

/**
 * Task 15d (2026-07-30): logo left, payment marks right, one row. Replaces
 * the old centred wordmark plus a standalone full-width payment-marks row.
 */
describe('Footer brand row — wordmark left, payment marks right (Task 15d)', () => {
  // FALLBACK_CHROME.footer ships with no payment badges configured — give
  // these tests real ones so there is something to assert about.
  const configWithBadges = {
    ...FALLBACK_CHROME.footer,
    paymentBadges: ['visa', 'mastercard', 'instapay'] as PaymentBadge[],
  };

  it('puts the wordmark and the payment marks in one row', () => {
    render(<Footer config={configWithBadges} />);
    const row = screen.getByTestId('footer-brand-row');
    expect(row).toContainElement(screen.getByTestId('footer-wordmark'));
    expect(row).toContainElement(screen.getByTestId('footer-payments'));
    expect(row).toHaveStyle({ justifyContent: 'space-between' });
  });

  it('renders the wordmark before the payment marks in document order (left, then right)', () => {
    render(<Footer config={configWithBadges} />);
    const wordmark = screen.getByTestId('footer-wordmark');
    const payments = screen.getByTestId('footer-payments');
    const position = wordmark.compareDocumentPosition(payments);
    // eslint-disable-next-line no-bitwise
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('no longer renders a standalone full-width payment-marks row — every badge lives inside footer-payments', () => {
    const { container } = render(<Footer config={configWithBadges} />);
    const payments = screen.getByTestId('footer-payments');
    const allBadges = container.querySelectorAll(
      '[aria-label="Visa"], [aria-label="Mastercard"], [aria-label="InstaPay"]',
    );
    expect(allBadges.length).toBe(3);
    allBadges.forEach((badge) => {
      expect(payments.contains(badge)).toBe(true);
    });
  });
});

/**
 * Owner request (2026-07-31): "the bottom of it has extra space on Y ...
 * optimize layout to decrease the Y-axis gaps between each section ... make
 * it equally consistent". Before this task the rhythm was four separate
 * hand-tuned clamp() values (newsletter margin, columns-grid marginTop,
 * socials marginTop, bottom-bar marginTop) that merely happened to be close
 * to each other — this test locks them to ONE shared value so the gaps
 * cannot silently drift apart again in a future edit.
 */
describe('Footer section rhythm — single shared gap (Owner request 2026-07-31)', () => {
  it('gives the newsletter, columns, socials, and bottom-bar sections the identical marginTop', () => {
    const configWithEverything = {
      ...FALLBACK_CHROME.footer,
      newsletterEnabled: true,
      newsletterEyebrow: 'Newsletter',
      newsletterBlurb: 'Blurb.',
      columns: [{ id: 'c1', title: 'Shop', links: [{ id: 'l1', label: 'All', href: '/shop' }] }],
      socials: [{ id: 's1', network: 'instagram' as const, url: 'https://instagram.com' }],
    };
    render(<Footer config={configWithEverything} />);

    const newsletter = screen.getByTestId('footer-newsletter');
    const columns = screen.getByTestId('footer-columns');
    const socials = screen.getByTestId('footer-socials');
    const bottomBar = screen.getByTestId('footer-bottom-bar');

    const gaps = [newsletter, columns, socials, bottomBar].map((el) => el.style.marginTop);

    // All four must be the exact same CSS value...
    expect(new Set(gaps).size).toBe(1);
    // ...and it must actually be a real, non-empty value, not four empty strings.
    expect(gaps[0]).toBeTruthy();
  });

  it('does not fork the gap by breakpoint — mobile and desktop share the same value', () => {
    // useBreakpoint reads matchMedia; jsdom's default (no matches) resolves
    // to desktop, so this asserts against the mobile-only ternary that used
    // to exist on the socials row (`mobile ? clamp(...) : 44`) and is gone.
    const configWithSocials = {
      ...FALLBACK_CHROME.footer,
      socials: [{ id: 's1', network: 'instagram' as const, url: 'https://instagram.com' }],
    };
    render(<Footer config={configWithSocials} />);
    const socials = screen.getByTestId('footer-socials');
    const columns = screen.getByTestId('footer-columns');
    expect(socials.style.marginTop).toBe(columns.style.marginTop);
  });
});

/**
 * #50 — "the footer is still broken, sometimes reveals correctly and sometimes
 * opens as if its under the webpage… snaps to change its position".
 *
 * The curtain has two modes and both are correct (see the long note in
 * Footer.tsx). What was not correct is that the CHOICE between them was
 * recomputed from `window.innerHeight` — which on a phone is not a constant.
 * iOS Safari and Chrome Android collapse and expand their toolbars during a
 * scroll, moving it by 60-100px; the footer is ~749px on a 393px-wide phone and
 * a Pixel 5 in Chrome runs 727px (toolbar visible) to ~807px (collapsed), so
 * the comparison genuinely had a different answer depending on where the
 * toolbar happened to be, and the element jumped between its two
 * positions under the reader's finger — and at that point the two positions
 * were `fixed` and `absolute`, so the jump took `body`'s reserved band with it
 * and moved the page as well. Both modes are in normal flow now (#57), so the
 * worst a flip can do is move the footer; the decision is still made this way
 * because an unstable one was visible at all.
 *
 * jsdom has no layout engine, so `100svh` resolves to 0 and
 * `readSmallViewportHeight` falls through to `innerHeight` — which is exactly
 * the degradation path a browser without `svh` support takes, and it means
 * these tests exercise the OTHER half of the fix: the asymmetric, toolbar-proof
 * dead band. The `svh` half is covered end-to-end by
 * e2e/storefront/mobile-scroll-stability.spec.ts, which counts `data-curtain`
 * changes while resizing a real viewport mid-scroll.
 */
describe('Footer curtain — the mode must not change mid-scroll (#50)', () => {
  const PHONE_SMALL_VH = 727; // Pixel 5, Chrome toolbar VISIBLE
  const PHONE_LARGE_VH = 807; // the same phone, toolbar collapsed
  let originalRect: typeof HTMLElement.prototype.getBoundingClientRect;

  /** Make the curtain report a fixed height; everything else keeps jsdom's zero rect. */
  function stubCurtainHeight(height: number) {
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      const rect = originalRect.call(this);
      if (this.classList?.contains('mr-footer-curtain')) {
        return { ...rect, height } as DOMRect;
      }
      return rect;
    };
  }

  function setViewportHeight(height: number) {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
  }

  function mode(container: HTMLElement): string | null {
    return container.querySelector('.mr-footer-curtain')!.getAttribute('data-curtain');
  }

  beforeEach(() => {
    originalRect = HTMLElement.prototype.getBoundingClientRect;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 393 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: PHONE_SMALL_VH });
  });

  afterEach(() => {
    HTMLElement.prototype.getBoundingClientRect = originalRect;
  });

  it('falls back to flow for a footer taller than the viewport, as it always did', () => {
    stubCurtainHeight(749);
    const { container } = render(<Footer config={FALLBACK_CHROME.footer} />);
    // 749 > 727: stuck, its own top edge would be off screen and unreachable —
    // failure (1) in the Footer.tsx history. Demotion is immediate for exactly
    // that reason; it is a correctness rule, not a preference.
    expect(mode(container)).toBe('flow');
  });

  it('does not flip back to stuck when the toolbar collapses', () => {
    stubCurtainHeight(749);
    const { container } = render(<Footer config={FALLBACK_CHROME.footer} />);
    expect(mode(container)).toBe('flow');

    // THE BUG. 749 <= 807 is true, so the old code promoted to `stuck` here —
    // and demoted again the moment the toolbar came back. One flip per toolbar
    // movement, under the reader's finger.
    setViewportHeight(PHONE_LARGE_VH);
    expect(mode(container)).toBe('flow');

    setViewportHeight(PHONE_SMALL_VH);
    expect(mode(container)).toBe('flow');

    setViewportHeight(PHONE_LARGE_VH);
    expect(mode(container)).toBe('flow');
  });

  it('stays stuck across a toolbar cycle when the footer genuinely fits', () => {
    stubCurtainHeight(420);
    const { container } = render(<Footer config={FALLBACK_CHROME.footer} />);
    expect(mode(container)).toBe('stuck');

    setViewportHeight(PHONE_LARGE_VH);
    expect(mode(container)).toBe('stuck');
    setViewportHeight(PHONE_SMALL_VH);
    expect(mode(container)).toBe('stuck');
  });

  it('promotes back to stuck only on a viewport with real headroom to spare', () => {
    stubCurtainHeight(749);
    const { container } = render(<Footer config={FALLBACK_CHROME.footer} />);
    expect(mode(container)).toBe('flow');

    // A genuine resize that clears the footer by less than a toolbar's worth is
    // still refused — that margin is what stops the mode oscillating around the
    // boundary when the measurement itself is noisy.
    setViewportHeight(800);
    expect(mode(container)).toBe('flow');

    // Clear headroom (749 + the 120px dead band = 869): the reveal comes back.
    setViewportHeight(900);
    expect(mode(container)).toBe('stuck');
  });

  /**
   * The other half of "sometimes reveals correctly and sometimes opens as if
   * its under the webpage", and it is not a toolbar at all.
   *
   * The dead band is asymmetric so a noisy VIEWPORT cannot walk the mode back
   * and forth. But the FOOTER's own height is noisy exactly once, at the start,
   * and in one direction: measured on the production build at 1440x720, this
   * footer reads 840px at 154ms on the fallback fonts and 667px at 385ms once
   * the webfonts swap in. 840 > 720 demotes; 667 can then never promote back,
   * because the band demands 600. That laptop lost the reveal permanently, with
   * 53px of headroom to spare, on the strength of a reading taken before the
   * page had its fonts.
   *
   * Until `document.fonts.ready` resolves the decision is symmetric — what is
   * changing is the footer settling, not the viewport moving. Demotion stays
   * immediate throughout, so the unreachable-footer case is never entered.
   */
  it('a height measured before the webfonts land cannot demote it for good', async () => {
    const original = Object.getOwnPropertyDescriptor(document, 'fonts');
    let landFonts: () => void = () => {};
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { ready: new Promise<void>((resolve) => { landFonts = resolve; }) },
    });

    try {
      // First paint, fallback fonts: the footer measures far taller than it
      // will end up. Demotion is still immediate — that part is correctness.
      stubCurtainHeight(840);
      const { container } = render(<Footer config={FALLBACK_CHROME.footer} />);
      expect(mode(container)).toBe('flow');

      // The webfonts land and the footer is its real height, which fits the
      // 727px viewport with room to spare — but NOT by the 120px the toolbar
      // dead band would demand (667 > 727 - 120). Before this fix it stayed in
      // `flow` for the life of the page.
      stubCurtainHeight(667);
      await act(async () => {
        landFonts();
        // The component registered its own `.then` on this same promise before
        // we resolved it, so awaiting it here lets that callback run first;
        // the extra tick flushes the state update it schedules.
        await (document.fonts as unknown as { ready: Promise<void> }).ready;
        await Promise.resolve();
      });
      expect(mode(container)).toBe('stuck');

      // And from here nothing has changed about #50. A toolbar-sized move is
      // inside the dead band, so it re-uses the cached small-viewport reading
      // and does not touch the mode...
      setViewportHeight(660);
      expect(mode(container)).toBe('stuck');
      setViewportHeight(727);
      expect(mode(container)).toBe('stuck');

      // ...while a genuine viewport change still demotes immediately, and the
      // band still refuses to promote back on less than a toolbar's headroom
      // (667 needs 787 to return, and 727 is not it).
      setViewportHeight(600);
      expect(mode(container)).toBe('flow');
      setViewportHeight(727);
      expect(mode(container)).toBe('flow');
    } finally {
      if (original) Object.defineProperty(document, 'fonts', original);
      else delete (document as unknown as { fonts?: unknown }).fonts;
    }
  });
});
