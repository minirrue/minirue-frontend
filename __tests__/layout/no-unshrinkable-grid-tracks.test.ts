import fs from 'node:fs';
import path from 'node:path';

/**
 * No single-column grid declared as a bare `1fr`.
 *
 * A bare `1fr` is `minmax(auto, 1fr)`, and that `auto` minimum refuses to
 * shrink the track below its content's min-content width. On a desktop there is
 * usually slack and nothing shows; on a phone the track grows past the viewport
 * and the whole grid spills to the right — the left stays correctly inset by
 * the gutter, so it reads as the page being "laid off to the right and cut".
 *
 * It happened twice, in the same shape, and cost three separate bug reports
 * before it was found (owner, 2026-08-21):
 *
 *   app/cart/page.tsx      mobile ? '1fr' : 'minmax(0, 1fr) …'
 *   app/checkout/page.tsx  mobile ? '1fr' : 'minmax(0, 1fr) …'
 *
 * Both had the desktop branch right and the mobile branch wrong, which is
 * exactly why it only ever failed on a phone and survived every desktop check.
 *
 * A static test rather than a rendering one because jsdom does no layout — no
 * test in this suite can measure an overflow. A grep is crude, but it catches
 * the specific mistake at the moment it is typed.
 *
 * Scoped deliberately to a track list of EXACTLY `1fr`. `minmax(140px, 1fr)`
 * and `repeat(auto-fill, minmax(…, 1fr))` are not flagged: their minimum is
 * definite, so the implicit-`auto` trap does not apply, and firing on them
 * would only train people to ignore this test.
 */

const ROOTS = ['app', 'components'];

/** A whole track list of exactly `1fr` — `'1fr'`, `"1fr"` or a `1fr` template. */
const SINGLE_BARE_FR = /['"`]\s*1fr\s*['"`]/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      walk(full, out);
    } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

describe('a single-column grid can always shrink', () => {
  it("declares it as minmax(0, 1fr), never a bare '1fr'", () => {
    const offenders: string[] = [];

    for (const root of ROOTS) {
      const dir = path.join(process.cwd(), root);
      if (!fs.existsSync(dir)) continue;

      for (const file of walk(dir)) {
        fs.readFileSync(file, 'utf8')
          .split('\n')
          .forEach((line, i) => {
            if (!line.includes('gridTemplateColumns')) return;
            if (!SINGLE_BARE_FR.test(line)) return;
            offenders.push(
              `${path.relative(process.cwd(), file)}:${i + 1} — ${line.trim()}`,
            );
          });
      }
    }

    expect(offenders).toEqual([]);
  });
});
