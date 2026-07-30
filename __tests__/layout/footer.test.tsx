import React from 'react';
import { render, screen } from '@testing-library/react';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import Footer from '@/components/layout/Footer';
import { FALLBACK_CHROME } from '@/lib/api/storefront';

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
