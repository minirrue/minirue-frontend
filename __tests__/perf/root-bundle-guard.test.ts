import fs from 'node:fs';
import path from 'node:path';

/**
 * Nothing reachable from the root layout may pull in a heavyweight library.
 *
 * `app/layout.tsx` wraps every page, so anything its client components import
 * ships to every visitor on every route — including people who never open a
 * cart or a checkout.
 *
 * ## The bug this pins down (#7)
 *
 * `CartProvider` is mounted in the root layout. `CartContext` imported one
 * three-line helper:
 *
 *     import { subtotalToMinor } from '@/lib/checkout/checkout-schemas';
 *
 * and that module also exported two zod schemas — `checkoutAddressSchema` and
 * `checkoutPaymentSchema` — which had **no consumers anywhere in the app**.
 *
 * So all of zod rode into the first-load bundle of every page to support dead
 * code. Measured on the live product page: a 253 KB chunk that was 91% zod,
 * ~63 KB brotli over the wire, the largest library on the route after
 * react-dom. It is exactly why #7's two symptoms are the product page and the
 * cart — those are what `CartContext` is on the critical path for.
 *
 * Splitting the money helpers into `lib/checkout/checkout-money.ts` (which
 * imports nothing at all) took zod off every route but the four `(auth)` pages
 * that legitimately validate forms with it.
 *
 * ## Why a static test rather than a bundle-size budget
 *
 * A byte budget tells you the number moved and not what moved it, and it needs
 * a build to run. This walks the actual import graph from the root layout and
 * names the file and the chain — which is the thing a person needs in order to
 * fix it. It runs in milliseconds and catches the regression at the moment
 * someone writes the import.
 */

const ROOT = process.cwd();

/**
 * Libraries that must never be reachable from the root layout.
 *
 * `motion` is here because of how it got in last time, which this guard would
 * have caught at the moment the import was written. `Footer` is in the root
 * layout and imported `TextEffect`, which imported `motion/react` to animate
 * one line of small print — so a ~56KB animation library shipped on the cart,
 * the shop index and every other route to fade in "Powered by Ebneely" (#74).
 *
 * It is uninstalled now, so a static import would also fail the build. The
 * entry stays because the failure mode is someone reaching for an animation,
 * running `npm install motion`, and putting it in a layout component — which
 * is exactly the sequence that happened. A red test naming the import chain is
 * a better answer at that moment than a build error about a missing package,
 * because the build error is fixed by installing it.
 */
const BANNED = ['zod', 'gsap', 'motion'];

/**
 * Modules allowed to appear in the graph despite matching a banned name —
 * none today. Kept so an exception is an explicit, reviewable line rather than
 * a quietly loosened regex.
 */
const ALLOWED: string[] = [];

function resolveImport(spec: string, fromFile: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = path.join(ROOT, spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(fromFile), spec);
  else return null; // a package, not a local module

  for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
    if (fs.existsSync(base + ext)) return base + ext;
  }
  for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
    const idx = path.join(base, 'index' + ext);
    if (fs.existsSync(idx)) return idx;
  }
  return null;
}

/** Every `from '…'` specifier in a file, import and re-export alike. */
function specifiersOf(source: string): string[] {
  // A whole-statement `import type … from` is erased by TypeScript and ships
  // nothing (#76: SupportWidget needs the chat panel's TYPES while the panel
  // itself loads later). `import X, { type Y } from` is a value import and
  // still counts.
  const withoutTypeImports = source.replace(/^\s*import\s+type\s[^;]*?from\s+['"][^'"]+['"]/gm, '');
  return [...withoutTypeImports.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
}

/**
 * Walk out from the root layout and return, for each banned package, the
 * shortest import chain that reaches it.
 */
function findBanned(entry: string): Record<string, string[]> {
  const seen = new Set<string>();
  const queue: Array<{ file: string; chain: string[] }> = [
    { file: entry, chain: [path.relative(ROOT, entry)] },
  ];
  const offenders: Record<string, string[]> = {};

  while (queue.length) {
    const { file, chain } = queue.shift()!;
    if (seen.has(file)) continue;
    seen.add(file);

    let source: string;
    try {
      source = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }

    for (const spec of specifiersOf(source)) {
      const pkg = spec.startsWith('@')
        ? spec.split('/').slice(0, 2).join('/')
        : spec.split('/')[0];

      if (BANNED.includes(pkg) && !ALLOWED.includes(path.relative(ROOT, file))) {
        offenders[pkg] ??= [...chain, `imports '${spec}'`];
        continue;
      }

      const next = resolveImport(spec, file);
      if (next && !seen.has(next)) {
        queue.push({ file: next, chain: [...chain, path.relative(ROOT, next)] });
      }
    }
  }
  return offenders;
}

describe('the root layout import graph', () => {
  const entry = path.join(ROOT, 'app/layout.tsx');

  it('has a root layout to walk from', () => {
    // Guards the guard: if the entry point moves, every assertion below would
    // pass on an empty graph.
    expect(fs.existsSync(entry)).toBe(true);
    expect(specifiersOf(fs.readFileSync(entry, 'utf8')).length).toBeGreaterThan(5);
  });

  it('reaches more than a handful of modules, so the walk really walks', () => {
    // The same failure in the other direction: a resolver that returned null
    // for everything would find no offenders and look green.
    const seen = new Set<string>();
    const queue = [entry];
    while (queue.length) {
      const f = queue.shift()!;
      if (seen.has(f)) continue;
      seen.add(f);
      let src = '';
      try {
        src = fs.readFileSync(f, 'utf8');
      } catch {
        continue;
      }
      for (const spec of specifiersOf(src)) {
        const next = resolveImport(spec, f);
        if (next && !seen.has(next)) queue.push(next);
      }
    }
    expect(seen.size).toBeGreaterThan(30);
  });

  it('does not reach zod, gsap or motion', () => {
    const offenders = findBanned(entry);

    // The message is the point: it names the chain, so whoever broke it knows
    // which import to move rather than being told a number went up.
    expect(
      Object.entries(offenders).map(([pkg, chain]) => `${pkg} via\n    ${chain.join('\n    ')}`),
    ).toEqual([]);
  });
});

describe('closed overlays load after the page, not with it (#76)', () => {
  /*
   * The chat panel and the header's search sheet, menu sheet and category
   * dropdown are closed on arrival on every page. They are reached only through
   * `import()` (lib/hooks/useIdleImport.ts), which this walker deliberately does
   * not follow — so a static import anywhere in these graphs, even a harmless-
   * looking one for a helper, puts them back in every route's first load.
   *
   * Measured when they were taken out: initial JS 268 -> 241 KB, FCP ~1700 ->
   * ~1480 ms, main-thread blocking ~900 -> ~700 ms (393px, 4x CPU, 1.6 Mbps).
   */
  const DEFERRED = [
    'components/chat/ChatPanel.tsx',
    'components/chat/NewChatComposer.tsx',
    'components/chat/ConversationList.tsx',
    'components/chat/SignInToChat.tsx',
    'components/chat/SubjectPicker.tsx',
    'components/layout/SearchSheet.tsx',
    'components/layout/MobileNavSheet.tsx',
    'components/layout/NavCategorySheet.tsx',
  ];

  function reachable(entry: string): Set<string> {
    const seen = new Set<string>();
    const queue = [path.join(ROOT, entry)];
    while (queue.length) {
      const f = queue.shift()!;
      if (seen.has(f)) continue;
      seen.add(f);
      let src = '';
      try {
        src = fs.readFileSync(f, 'utf8');
      } catch {
        continue;
      }
      for (const spec of specifiersOf(src)) {
        const next = resolveImport(spec, f);
        if (next && !seen.has(next)) queue.push(next);
      }
    }
    return new Set([...seen].map((f) => path.relative(ROOT, f).split(path.sep).join('/')));
  }

  it.each(['app/layout.tsx', 'components/layout/Header.tsx'])('%s does not statically reach them', (entry) => {
    const graph = reachable(entry);
    // Guard the guard: both entries really do reach the components that own them.
    expect(graph.has(entry === 'app/layout.tsx' ? 'components/chat/SupportWidget.tsx' : 'components/layout/Header.tsx')).toBe(true);
    expect(DEFERRED.filter((f) => graph.has(f))).toEqual([]);
  });

  it('the lazy modules really do contain them, so the walker is not just blind', () => {
    const parts = reachable('components/chat/support-panel-parts.ts');
    const sheets = reachable('components/layout/header-sheets.ts');
    expect(DEFERRED.filter((f) => !parts.has(f) && !sheets.has(f))).toEqual([]);
  });

  it('ignores only whole-statement type imports', () => {
    expect(specifiersOf("import type { A } from './a';\nimport B, { type C } from './b';")).toEqual(['./b']);
  });
});

describe('lib/checkout/checkout-money', () => {
  it('imports nothing at all', () => {
    /*
     * The rule that keeps #7 fixed. This module is reached from the root
     * layout, so ANY import here ships to every visitor on every page — which
     * is how a three-line money helper shipped 230 KB of zod.
     *
     * Asserted as "zero imports" rather than "no banned imports", because the
     * next library to sneak in will not be one anybody thought to ban.
     */
    const source = fs.readFileSync(
      path.join(ROOT, 'lib/checkout/checkout-money.ts'),
      'utf8',
    );

    expect(specifiersOf(source)).toEqual([]);
  });
});
