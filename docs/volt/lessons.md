# Volt lessons — minirue-frontend

Read at the start of every session that touches this repo (volt Step 0).
Record a lesson the moment a mistake happens; evolve before landing.
Format and rules: `~/.claude/skills/volt/references/evolve.md`

---

### 1. Verify visual/interactive work in real Chrome against a production build — dev lies
- **Trap:** several defects only showed on a real browser: a video downloading twice, reduced-motion users downloading a clip, a hero change that regressed LCP (#33, reverted in #34).
- **Do:** anything visual ends in a screenshot; anything with network or motion is measured with `playwright` `channel: 'chrome'` against `next build` + `.next/standalone/server.js` (copy `public` and `.next/static` into `.next/standalone` first). Measure the outcome, not the mechanism.
- **Check:** request counts / aborted requests via CDP `Network.*`, several runs, plus a screenshot.
- **Seen:** 2026-09-13, #33, #74, #78 · **Hits:** 3 — promote: a `verify:prod` script that builds, serves standalone and runs a given check

### 2. React sets `src` while assembling a media element — assign it imperatively
- **Trap:** `<video src={x} preload autoplay>` created by React made a second, cancelled request in 3/5 runs (up to 3.4 MB lost). A plain static `<video>` made exactly one.
- **Do:** render `<video>` with no `src`; assign `el.src` once in an effect, guarded by `el.getAttribute('src') !== src`.
- **Check:** CDP `Network.loadingFailed` = 0 for the file across ≥5 runs, next to a plain-HTML control on the same server.
- **Seen:** 2026-09-13, #78 · **Hits:** 1

### 3. During hydration a `useSyncExternalStore` hook returns its SERVER snapshot
- **Trap:** `usePrefersReducedMotion()` read `false` during hydration, so an effect loaded a hero video for a reduced-motion visitor before the real value re-rendered it away.
- **Do:** an effect that does something expensive based on a media query checks `window.matchMedia(...)` directly at that moment, not the hook's value.
- **Check:** Playwright `reducedMotion: 'reduce'` → 0 requests for the asset.
- **Seen:** 2026-09-13, #78 · **Hits:** 1

### 4. Controls that don't disprove anything
- **Trap:** a Playwright mouse drag does not scroll a native scroll container (the swipe test "failed" and proved nothing); a control page 404'd and reported "0 requests"; `next start` does not serve `output: standalone`; the standalone server reads `public/` only at startup.
- **Do:** before trusting a pass or a fail, confirm the harness can exercise the behaviour (touch via `Input.dispatchTouchEvent`), and `curl` every control URL for 200 first.
- **Check:** the control shows the expected baseline before it is compared with anything.
- **Seen:** 2026-09-13, #74, #78 · **Hits:** 3

### 5. `from 'x'` does not find `await import('x')`
- **Trap:** "no importers" nearly removed `gsap`, which the splash screen lazy-loads.
- **Do:** search both `from 'x'` and `import('x')` before calling a dependency unused.
- **Check:** `grep -rn "from 'x'\|import('x')" app components lib`.
- **Seen:** 2026-09-13, #75 · **Hits:** 1

### 6. Guard tests encode decisions — read them before "fixing" around them
- **Trap:** a bare `unoptimized` on a hero `<Image>` failed `hero-srcset.test.ts`; `root-bundle-guard.test.ts` bans libraries from the root layout graph.
- **Do:** when a guard fails, read its header and satisfy its intent (e.g. `loader={heroImageLoader(null)}`), never reshape code to dodge its regex. Extend guards when you remove something (motion added to the bundle guard).
- **Check:** the guard passes and its comment still describes the code.
- **Seen:** 2026-09-13, #75, #78 · **Hits:** 2

### 7. Deleting a Next route leaves stale generated types in `.next/dev/types`
- **Trap:** `tsc --noEmit` failed on `.next/dev/types/validator.ts` referencing a removed throwaway route.
- **Do:** `rm -rf .next/dev/types` after deleting a route, then retypecheck. Throwaway verification routes are prefixed `zz-` and removed before commit.
- **Check:** `git status` shows no `zz-` files; `tsc` clean.
- **Seen:** 2026-09-13 · **Hits:** 2

### 8. Backticks inside a template literal end it — including in a CSS comment
- **Trap:** a CSS comment inside a JS template literal contained `` `backwards` `` and broke the build.
- **Do:** no backticks inside template-literal CSS/HTML; write the word plainly.
- **Check:** `tsc` clean.
- **Seen:** 2026-09-13, #74 · **Hits:** 1

### 9. Splicing a file by text markers can swallow what sits between them
- **Trap:** replacing "from component A's comment to `export default`" also deleted `SlideContentProps` and `safeHexColor`, which lived in between.
- **Do:** splice to the *next declaration* after the target, keep a backup (`cp f /tmp/f.bak`), and assert the survivors still exist after the edit.
- **Check:** grep for every top-level declaration that should remain.
- **Seen:** 2026-09-13, #78 · **Hits:** 1
