import { test, expect, devices, type Page } from '@playwright/test';

/**
 * Mobile scroll stability — the harness for #50 (footer curtain snapping) and
 * #51 (header strobing).
 *
 * WHY THIS FILE EXISTS AT ALL
 * ===========================
 * #48 shipped both of these bugs with a passing verification, because the
 * verification ran in a fixed-height headless viewport driven by
 * `window.scrollTo`. In that environment:
 *
 *   - `window.innerHeight` is a CONSTANT, so `height <= window.innerHeight`
 *     (Footer.tsx) can never flip mid-scroll and the curtain never snaps; and
 *   - a scripted `scrollTo` is perfectly MONOTONIC, so a direction hook with
 *     any threshold at all reports one direction for the whole traversal and
 *     the header never strobes.
 *
 * Both bugs live exactly in the gap between that and a phone. So this file
 * reproduces the two conditions a phone actually has:
 *
 *   1. A JITTERY scroll stream. A thumb dragging slowly is not monotonic — it
 *      is forward motion with periodic roll-back. A Pixel 5 is ~70mm wide for
 *      393 CSS px, i.e. ~5.6 CSS px per mm, so a 2mm thumb roll-back is ~11
 *      CSS px: larger than useScrollDirection's 8px threshold. `nudgeScroll`
 *      below models that.
 *
 *   2. A viewport whose HEIGHT CHANGES DURING THE SCROLL. iOS Safari and
 *      Chrome Android collapse and expand their toolbars as you scroll, moving
 *      `window.innerHeight` by 60-100px. `page.setViewportSize` between scroll
 *      steps reproduces it: Chromium really does change `innerHeight`, really
 *      does re-run the ResizeObserver, and really does fire `resize`.
 *
 * Both tests COUNT state changes rather than eyeballing them, because "less
 * frequent" and "fixed" look identical by eye and only a count separates them.
 */

const PHONE = devices['Pixel 5'];

/**
 * The Pixel 5 profile's own portrait size. Note what this number IS: 393x727
 * on a device whose screen is 393x851. The missing 124px is the status bar and
 * Chrome's toolbar — so this height is the SMALL viewport, the one you get with
 * the toolbar VISIBLE. That is the resting state, and the toolbar collapsing
 * makes the viewport GROW, not shrink. Getting that backwards is how you write
 * a toolbar simulation that reproduces nothing.
 */
const VIEWPORT = { width: 393, height: 727 };

/**
 * How much a mobile browser toolbar moves the viewport. Chrome Android's top
 * toolbar is 56dp and Safari's bottom bar is comparable; 80px is the middle of
 * the 60-100px band the issues quote, and 727+80 = 807 is close to the real
 * toolbar-collapsed height of a Pixel 5.
 *
 * The footer measures ~749px on this width — i.e. it lands INSIDE the
 * 727..807 band, which is precisely the condition #50 describes: the
 * `height <= window.innerHeight` comparison has a different answer depending on
 * where the toolbar happens to be.
 */
const TOOLBAR_PX = 80;

test.use({
  ...PHONE,
  viewport: VIEWPORT,
  // The app is served by the caller (see the header comment in the run script);
  // baseURL comes from MR_BASE_URL so this can run against a standalone build
  // on any port rather than starting a dev server.
  baseURL: process.env.MR_BASE_URL || 'http://127.0.0.1:3132',
});

/**
 * Records every DISTINCT value the header's inline `transform` takes, and every
 * distinct value of the curtain's `data-curtain`, sampled once per animation
 * frame.
 *
 * Inline transform, not computed transform: the computed value animates
 * continuously through the 280ms transition, so counting it would count frames.
 * The inline value is the DECISION — "hide" or "show" — and a count of how many
 * times it changes is exactly a count of how many times the bar was asked to
 * reverse. That is the number the issue asks for.
 */
async function installProbe(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as {
      __mrProbe?: {
        header: string[];
        curtain: string[];
        innerHeights: number[];
        stop: () => void;
      };
    };
    w.__mrProbe?.stop();

    const header: string[] = [];
    const curtain: string[] = [];
    const innerHeights: number[] = [];
    let running = true;

    const tick = () => {
      if (!running) return;
      const h = document.querySelector<HTMLElement>('[data-testid="site-header"]');
      const c = document.querySelector<HTMLElement>('.mr-footer-curtain');
      if (h) {
        const t = h.style.transform || '(none)';
        if (header[header.length - 1] !== t) header.push(t);
      }
      if (c) {
        const m = c.getAttribute('data-curtain') || '(none)';
        if (curtain[curtain.length - 1] !== m) curtain.push(m);
      }
      const ih = window.innerHeight;
      if (innerHeights[innerHeights.length - 1] !== ih) innerHeights.push(ih);
      requestAnimationFrame(tick);
    };

    w.__mrProbe = { header, curtain, innerHeights, stop: () => { running = false; } };
    requestAnimationFrame(tick);
  });
}

async function readProbe(page: Page) {
  return page.evaluate(() => {
    const w = window as unknown as {
      __mrProbe: { header: string[]; curtain: string[]; innerHeights: number[] };
    };
    return {
      header: w.__mrProbe.header,
      curtain: w.__mrProbe.curtain,
      innerHeights: w.__mrProbe.innerHeights,
      scrollY: window.scrollY,
      docHeight: document.documentElement.scrollHeight,
    };
  });
}

/**
 * One slow, jittery thumb-drag's worth of scrolling.
 *
 * `forward` px per tick with a `back` px roll-back every `backEvery` ticks —
 * net downward, never monotonic. One `requestAnimationFrame` per tick, so the
 * rAF-throttled hook samples every tick exactly as it would on a phone.
 */
async function nudgeScroll(
  page: Page,
  opts: { to: number; forward: number; back: number; backEvery: number },
) {
  await page.evaluate(async ({ to, forward, back, backEvery }) => {
    const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
    let y = window.scrollY;
    let i = 0;
    let guard = 0;
    while (y < to && guard++ < 4000) {
      i += 1;
      y += i % backEvery === 0 ? -back : forward;
      if (y < 0) y = 0;
      window.scrollTo(0, y);
      await frame();
      // Re-read: Lenis owns the root scroller and may correct us. Working from
      // the real position keeps the drag honest instead of drifting into a
      // position the page is not actually at.
      y = window.scrollY;
    }
  }, opts);
}

test.describe('#51 — the mobile header must not strobe on a slow, jittery scroll', () => {
  test('counts header transform changes over one slow traversal', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="site-header"]');
    // Let hydration settle so the hook's listener is attached before we scroll.
    await page.waitForTimeout(1500);

    await installProbe(page);
    await nudgeScroll(page, { to: 1400, forward: 13, back: 11, backEvery: 4 });

    const probe = await readProbe(page);
    const flips = Math.max(0, probe.header.length - 1);
    console.log(
      `[#51] header transform changes over a ${probe.scrollY}px jittery drag: ${flips}`,
      JSON.stringify(probe.header),
    );

    /*
     * The gate. One deliberate gesture is one state change; the traversal below
     * is a single sustained downward drag, so the bar should be asked to hide
     * once and then left alone. Four allows for the initial settle plus a
     * genuine reversal; the pre-fix number is an order of magnitude above it.
     */
    expect(flips).toBeLessThanOrEqual(4);
  });

  test('still hides on a real downward scroll and returns on a real upward one', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="site-header"]');
    await page.waitForTimeout(1500);

    const header = page.locator('[data-testid="site-header"]');
    // The browser normalises `translateY(0)` to `translateY(0px)`, so compare
    // on the DECISION ("is it asked to be off screen?") rather than the string.
    const hidden = () =>
      header.evaluate((el) => (el as HTMLElement).style.transform.includes('-100%'));

    // A decisive downward swipe.
    await page.evaluate(() => window.scrollTo(0, 900));
    await expect.poll(hidden, { timeout: 3000 }).toBe(true);

    // A decisive upward swipe — must come back promptly, not after 600px.
    // 70px is a flick of the thumb, well short of the 900px it would take to
    // undo the drag; the reveal has to be eager or a reader reaching for the
    // nav does not get it.
    await page.evaluate(() => window.scrollTo(0, 830));
    await expect.poll(hidden, { timeout: 3000 }).toBe(false);

    // And at the very top it is always visible.
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(hidden, { timeout: 3000 }).toBe(false);
  });
});

test.describe('#50 — the footer curtain must not change positioning mode mid-scroll', () => {
  test('counts data-curtain changes while the toolbar collapses and expands', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.mr-footer-curtain');
    await page.waitForTimeout(1500);

    const curtainHeight = await page.evaluate(
      () =>
        Math.ceil(
          document
            .querySelector('.mr-footer-curtain')!
            .getBoundingClientRect().height,
        ),
    );
    console.log(`[#50] measured curtain height: ${curtainHeight}px, viewport ${VIEWPORT.height}px`);

    await installProbe(page);

    /*
     * Scroll, and collapse/expand the toolbar while doing it. `setViewportSize`
     * really does move `window.innerHeight` in Chromium, which is the input
     * `setPinned(height <= window.innerHeight)` reads — so this is the phone's
     * condition, not an approximation of it.
     */
    for (let i = 0; i < 6; i++) {
      await nudgeScroll(page, {
        to: 200 + i * 220,
        forward: 13,
        back: 11,
        backEvery: 4,
      });
      await page.setViewportSize({
        width: VIEWPORT.width,
        height: i % 2 === 0 ? VIEWPORT.height + TOOLBAR_PX : VIEWPORT.height,
      });
      await page.waitForTimeout(120);
    }

    const probe = await readProbe(page);
    const modeChanges = Math.max(0, probe.curtain.length - 1);
    console.log(
      `[#50] data-curtain changes: ${modeChanges}`,
      JSON.stringify(probe.curtain),
      'innerHeights seen:',
      JSON.stringify(probe.innerHeights),
    );

    // The viewport really did move — otherwise this test proves nothing.
    expect(probe.innerHeights.length).toBeGreaterThan(1);
    // And the curtain did not care.
    expect(modeChanges).toBe(0);
  });

  /**
   * The guard on the fix itself.
   *
   * #50 floated "remove the switch entirely — always use flow" as the most
   * robust direction, on the grounds that it would delete the whole class of
   * bug. It would also delete the effect: `flow` is `absolute` inside the
   * reserved band at the true BOTTOM of the document, below `.mr-page-sheet`
   * rather than behind it, so the sheet never covers it and there is nothing to
   * uncover. This test is the measurement that settles that rather than
   * assuming it — on a viewport tall enough for the footer to fit, `pinned`
   * must still be chosen, must still be `fixed`, must still be COVERED by the
   * sheet mid-page, and must still be UNCOVERED at the end.
   */
  test('the reveal itself still works where the footer fits (pinned is not dead code)', async ({ page }) => {
    // 900 clears the ~749px footer by more than the promotion dead band.
    await page.setViewportSize({ width: VIEWPORT.width, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.mr-footer-curtain');
    await page.waitForTimeout(1500);

    const curtain = page.locator('.mr-footer-curtain');
    await expect(curtain).toHaveAttribute('data-curtain', 'pinned');
    expect(
      await curtain.evaluate((el) => getComputedStyle(el).position),
    ).toBe('fixed');

    // Mid-page: the curtain is parked at the bottom of the viewport, and the
    // page sheet is painted over it. Whatever is at that point must belong to
    // the sheet, not to the footer — that is what "under the webpage" means,
    // and it is the direction the owner reported as inverted.
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(400);
    const coveredBySheet = await page.evaluate(() => {
      // 200px up from the bottom edge, not 40: MobileBottomNav is
      // `position: fixed` at z-index 20 and owns the last ~74px of the
      // viewport below 1024px, so a probe nearer the edge hit-tests the nav
      // and tells you nothing about the curtain underneath.
      const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight - 200);
      return { inSheet: !!el?.closest('.mr-page-sheet'), inCurtain: !!el?.closest('.mr-footer-curtain') };
    });
    expect(coveredBySheet).toEqual({ inSheet: true, inCurtain: false });

    // At the end of the document the sheet has travelled up off it and the
    // footer is the thing on screen.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(600);
    const uncovered = await page.evaluate(() => {
      // 200px up from the bottom edge, not 40: MobileBottomNav is
      // `position: fixed` at z-index 20 and owns the last ~74px of the
      // viewport below 1024px, so a probe nearer the edge hit-tests the nav
      // and tells you nothing about the curtain underneath.
      const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight - 200);
      return !!el?.closest('.mr-footer-curtain');
    });
    expect(uncovered).toBe(true);
    await expect(page.locator('[data-testid="footer-wordmark"]')).toBeInViewport();
  });

  test('a footer taller than the viewport is still fully reachable, and its links click', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.mr-footer-curtain');
    await page.waitForTimeout(1500);

    // Scroll to the true bottom of the document.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(600);

    /*
     * Failure #1 in the Footer.tsx history: a bottom-pinned box taller than the
     * scrollport can never show its own top. The wordmark lives at the top of
     * the footer, so it is the canary.
     */
    const wordmark = page.locator('[data-testid="footer-wordmark"]');
    await expect(wordmark).toBeInViewport({ timeout: 3000 });

    /*
     * And a REAL pointer click at the link's own coordinates — not
     * `element.click()`, which bypasses hit testing and passed happily for the
     * `z-index: -1` attempt where every footer link rendered and did nothing.
     */
    const link = page.locator('[data-testid="footer-columns"] a').first();
    await expect(link).toBeVisible();
    const box = (await link.boundingBox())!;
    const hit = await page.evaluate(
      ({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        return !!el?.closest('[data-testid="footer-columns"] a');
      },
      { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    );
    expect(hit).toBe(true);
  });
});
