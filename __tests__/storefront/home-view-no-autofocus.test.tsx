/**
 * Regression guard: after a signup redirect lands a shopper on the home
 * page, nothing there should grab focus on mount. If it did, it would
 * reopen the mobile keyboard on a page with no visible input to explain it —
 * the exact symptom the owner reported.
 */
import React from 'react';
import { render } from '@testing-library/react';
import HomeView from '@/components/storefront/HomeView';
import type { ResolvedHome } from '@/lib/api/storefront';

describe('HomeView', () => {
  it('does not autofocus anything on mount', () => {
    const home = { sections: [], announcement: {} } as unknown as ResolvedHome;
    render(<HomeView home={home} />);
    expect(document.activeElement).toBe(document.body);
  });
});
