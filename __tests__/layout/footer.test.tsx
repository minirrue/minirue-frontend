import React from 'react';
import { render, screen } from '@testing-library/react';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import Footer from '@/components/layout/Footer';
import { FALLBACK_CHROME } from '@/lib/api/storefront';
import type { PaymentBadge } from '@/lib/api/storefront';

/**
 * W4a.1 — the footer's root fix: `position: fixed` -> `sticky`, and the
 * `ResizeObserver` / `document.body.style.paddingBottom` effect that used to
 * fake in-flow height is deleted outright (see Footer.tsx). These are the
 * highest-value tests in this task per the brief.
 *
 * Superseded in part: the positioning does not live on `<footer>` at all any
 * more. `fixed` and `sticky` both overlapped the page — `sticky` pinned a 697px
 * footer across an 851px viewport with the page still scrolling underneath —
 * and `z-index: -1`, the attempted fix, made every footer link unclickable. The
 * reveal is back, but it is the curtain WRAPPER that is positioned and it is
 * ordered under the page sheet by document order rather than by a z-index; the
 * whole argument is in __tests__/layout/footer-stacking.test.ts.
 *
 * What survives here unchanged is the deleted measuring effect, which is the
 * part of W4a.1 that was right: the curtain's height is still measured, but it
 * travels as a CSS custom property instead of an inline body style.
 */
describe('Footer position (W4a.1)', () => {
  it('leaves <footer> itself unpositioned, so it cannot overlap the page', () => {
    /*
     * All three positioned values were tried on this element in production and
     * all three overlapped: `fixed` clipped the footer's own top edge once it
     * grew taller than the viewport, `sticky` pinned it over the page sheet,
     * and the z-index that was supposed to settle that put its links behind
     * the page for pointer events. The wrapper is positioned instead.
     */
    render(<Footer config={FALLBACK_CHROME.footer} />);
    const footer = screen.getByRole('contentinfo');
    expect(footer.style.position).toBe('');
    expect(footer.style.bottom).toBe('');
    expect(footer.style.zIndex).toBe('');
  });

  it('renders the curtain wrapper around the whole footer band', () => {
    // The revealed layer is the signature + <footer> together, as one box, so
    // the curtain measures and moves them as one.
    const { container } = render(<Footer config={FALLBACK_CHROME.footer} />);
    const curtain = container.querySelector('.mr-footer-curtain');
    expect(curtain).not.toBeNull();
    expect(curtain).toContainElement(screen.getByRole('contentinfo'));
    // `pinned` (the reveal) or `flow` (the taller-than-the-viewport fallback).
    expect(curtain?.getAttribute('data-curtain')).toMatch(/^(pinned|flow)$/);
  });

  it('never writes document.body.style.paddingBottom (the measuring effect is gone)', () => {
    document.body.style.paddingBottom = '';
    const { unmount } = render(<Footer config={FALLBACK_CHROME.footer} />);
    expect(document.body.style.paddingBottom).toBe('');
    unmount();
    expect(document.body.style.paddingBottom).toBe('');
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
 * `<Footer>`/`<FooterWithSettings>` must render the footer BEFORE the sheet —
 * outside it, and as the EARLIER sibling.
 *
 * This flipped (it used to demand the footer come after the sheet) and the flip
 * is the fix, not a detail. The curtain is `position: fixed`, `.mr-page-sheet`
 * is `position: relative`, and neither declares a z-index — so the only thing
 * deciding which paints on top is DOCUMENT ORDER, in which the later sibling
 * wins. Rendered after the sheet, the footer paints OVER the page: that is the
 * bug the owner reported twice ("footer is broken its not reveled under the
 * webpage"), once with `fixed` and once with `sticky`. Rendered before it, the
 * sheet covers the footer and uncovers it on scroll, which is the effect.
 *
 * Ordering them with a z-index instead would work and is deliberately not done:
 * a positioned element with a z-index creates a stacking context, and the last
 * time `.mr-page-sheet` had one it sealed the mobile menu and the search sheet
 * under the bottom nav (see page-sheet-stacking.test.ts).
 *
 * A full RSC render isn't available in jest (several of these are async Server
 * Components hitting real fetchers), so this follows the same static-source-scan
 * convention `chrome-coverage.test.ts` already uses for "every <Header> usage
 * passes a navbar prop": find where `.mr-page-sheet`'s own `<div>` OPENS in the
 * source text and assert the footer render appears before that point.
 *
 * This scans the whole `app/` and `components/` tree — not a fixed list of
 * files — so a NEW page that renders its footer on the wrong side of the sheet
 * fails this test too, which is the whole point of making it structural.
 */
describe('Footer placement — before .mr-page-sheet, outside it', () => {
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

  it.each(relevant.map((f) => [path.relative(ROOT, f), f] as const))(
    '%s renders its footer before .mr-page-sheet opens, not inside or after it',
    (_label, file) => {
      const src = readFileSync(file, 'utf8');
      const openIdx = mrPageSheetOpenIndex(src);
      expect(openIdx).not.toBeNull();

      const footerMatch = /<Footer(?:WithSettings)?[\s/>]/.exec(src);
      expect(footerMatch).not.toBeNull();

      // Strictly earlier in the source, which for sibling JSX is strictly
      // earlier in the DOM, which is what makes the sheet paint on top.
      expect(footerMatch!.index).toBeLessThan(openIdx as number);
    },
  );
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
