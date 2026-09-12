import { defineConfig } from '@playwright/test';

/**
 * The mobile scroll-stability harness (#50 / #51), kept SEPARATE from
 * playwright.config.ts on purpose.
 *
 * The main config boots `npm run dev` on :3000 and mocks every API call. These
 * two bugs are about how the page behaves under a real, hydrated, production
 * build while the viewport height moves underneath it, so this config runs
 * against an already-running standalone server instead of starting its own —
 * point `MR_BASE_URL` at it:
 *
 *   NEXT_PUBLIC_API_URL=https://backend.minirueshop.com npx next build
 *   # `output: standalone` nests server.js under the worktree path
 *   cp -r .next/static   .next/standalone/<path>/.next/static
 *   cp -r public         .next/standalone/<path>/public
 *   cd .next/standalone/<path> && PORT=3132 HOSTNAME=127.0.0.1 node server.js
 *
 *   MR_BASE_URL=http://127.0.0.1:3132 npx playwright test \
 *     --config playwright.harness.config.ts
 *
 * It is excluded from the default e2e run (different testDir) so `npm run
 * test:e2e` is unaffected and never waits on a server it did not start.
 */
export default defineConfig({
  testDir: './e2e/storefront',
  testMatch: ['mobile-scroll-stability.spec.ts'],
  // The two counting tests drive the same page in ways that must not interleave.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 90_000,
  // `test-results/` is checked in at the repo root, so a harness run would
  // otherwise leave untracked artifacts in a tracked directory on every
  // invocation. `.next/` is already gitignored wholesale.
  outputDir: '.next/playwright-harness',
  use: { baseURL: process.env.MR_BASE_URL || 'http://127.0.0.1:3132' },
});
