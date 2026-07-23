'use client';

import React from 'react';
import { useStorefrontHome, useStorefrontChrome } from '@/lib/hooks';

/**
 * Internal QA harness for Task 15 (storefront read layer). Not part of the public site — proves
 * the SSR-prefetch + client-poll wiring works: this page's Server Component prefetches both
 * queries and dehydrates them, so this client tree hydrates with data already present (no
 * loading flash, no duplicate request), then `useStorefrontHome` / `useStorefrontChrome` take
 * over polling every 30s so a save made in the dashboard shows up here without a reload.
 */
export default function StorefrontLiveClient() {
  const home = useStorefrontHome();
  const chrome = useStorefrontChrome();

  return (
    <div style={{ padding: 32, fontFamily: 'monospace', fontSize: 13 }}>
      <h1>Storefront live-read QA harness</h1>
      <p>Polls /v1/storefront/home and /v1/storefront/chrome every 30s. No reload needed.</p>

      <h2>chrome.footer.secondaryLine</h2>
      <pre data-testid="secondary-line">{chrome.data?.footer.secondaryLine ?? '(loading)'}</pre>

      <h2>chrome status</h2>
      <pre>
        {JSON.stringify(
          {
            isFetching: chrome.isFetching,
            dataUpdatedAt: chrome.dataUpdatedAt
              ? new Date(chrome.dataUpdatedAt).toISOString()
              : null,
          },
          null,
          2,
        )}
      </pre>

      <h2>home.sections.length</h2>
      <pre data-testid="sections-length">{home.data ? home.data.sections.length : '(loading)'}</pre>

      <h2>home status</h2>
      <pre>
        {JSON.stringify(
          {
            isFetching: home.isFetching,
            dataUpdatedAt: home.dataUpdatedAt ? new Date(home.dataUpdatedAt).toISOString() : null,
          },
          null,
          2,
        )}
      </pre>
    </div>
  );
}
