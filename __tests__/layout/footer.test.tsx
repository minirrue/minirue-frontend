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
 */
describe('Footer position (W4a.1)', () => {
  it('renders with position: sticky, not fixed', () => {
    render(<Footer config={FALLBACK_CHROME.footer} />);
    const footer = screen.getByRole('contentinfo');
    expect(footer.style.position).toBe('sticky');
    expect(footer.style.position).not.toBe('fixed');
    expect(footer.style.bottom).toBe('0px');
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
 * `<Footer>`/`<FooterWithSettings>` must render the footer OUTSIDE the sheet.
 * A full RSC render isn't available in jest (several of these are async
 * Server Components hitting real fetchers), so this follows the same
 * static-source-scan convention `chrome-coverage.test.ts` already uses for
 * "every <Header> usage passes a navbar prop": walk the div nesting in the
 * SOURCE TEXT to find where `.mr-page-sheet`'s own `<div>` closes, and assert
 * the footer render appears after that point, not before it.
 *
 * This scans the whole `app/` and `components/` tree — not a fixed list of
 * files — so a NEW page that reintroduces the inside-the-sheet mistake fails
 * this test too, which is the whole point of making it structural.
 */
describe('Footer placement — outside .mr-page-sheet (W4a.1)', () => {
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

  /** Index just past the closing `</div>` of the FIRST div found to contain
   *  `mr-page-sheet` in its opening tag, tracking nesting depth so an inner
   *  `<div>...</div>` inside the sheet (there are many) doesn't fool it into
   *  stopping early. Returns null if the source doesn't balance (treated as
   *  "couldn't verify" — the caller skips rather than false-fails). */
  /** Matches an actual `className="mr-page-sheet"` (or `'...'`) attribute —
   *  not just the bare substring, which also shows up in prose comments
   *  (this test file's own subject, Footer.tsx, documents the sticky fix in
   *  a comment that says ".mr-page-sheet" and is correctly NOT part of the
   *  audit: it renders `<footer>`, the element, never `<Footer>`, a JSX
   *  usage of the component). */
  const PAGE_SHEET_CLASS_RE = /className=(["'])[^"']*\bmr-page-sheet\b[^"']*\1/;

  function mrPageSheetCloseIndex(src: string): number | null {
    const classMatch = PAGE_SHEET_CLASS_RE.exec(src);
    if (!classMatch) return null;
    const tagStart = src.lastIndexOf('<div', classMatch.index);
    if (tagStart === -1) return null;

    const tagRe = /<div\b|<\/div>/g;
    tagRe.lastIndex = tagStart;
    let depth = 0;
    let match: RegExpExecArray | null;
    while ((match = tagRe.exec(src))) {
      if (match[0] === '<div' || match[0].startsWith('<div')) {
        // `<div\b` can match `<div` followed by a space or `>`; either way
        // it's an opening tag here since we already excluded `</div>`.
      }
      if (match[0] === '</div>') {
        depth -= 1;
      } else {
        depth += 1;
      }
      if (depth === 0) return tagRe.lastIndex;
    }
    return null;
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
    '%s renders its footer after .mr-page-sheet closes, not inside it',
    (_label, file) => {
      const src = readFileSync(file, 'utf8');
      const closeIdx = mrPageSheetCloseIndex(src);
      expect(closeIdx).not.toBeNull();

      const footerMatch = /<Footer(?:WithSettings)?[\s/>]/.exec(src);
      expect(footerMatch).not.toBeNull();

      expect(footerMatch!.index).toBeGreaterThan(closeIdx as number);
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
