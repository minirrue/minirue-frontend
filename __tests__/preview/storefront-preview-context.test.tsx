/**
 * The draft preview reuses the live components through a context (#193).
 * These pin both halves of that bargain:
 *  - inside the provider the storefront hooks return the DRAFT and never
 *    fetch the live layout (which would show stale data as if it were the
 *    draft), and previewable blocks carry `data-preview-id`;
 *  - outside it — every live page — nothing changes: the hooks fetch as
 *    before and no preview attribute is rendered.
 */
import React from 'react';
import { render, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import HomeView from '@/components/storefront/HomeView';
import { StorefrontPreviewProvider } from '@/lib/hooks/storefront-preview';
import { useStorefrontChrome, useStorefrontHome } from '@/lib/hooks/use-storefront';
import type { ResolvedChrome, ResolvedHome } from '@/lib/api/storefront';
import * as storefrontApi from '@/lib/api/storefront';

jest.mock('@/lib/api/storefront', () => ({
  ...jest.requireActual('@/lib/api/storefront'),
  fetchStorefrontHome: jest.fn(),
  fetchStorefrontChrome: jest.fn(),
}));

jest.mock('@/components/storefront/SectionRenderer', () => ({
  __esModule: true,
  default: ({ section }: { section: { id: string } }) => <section>{section.id}</section>,
}));

const LIVE_HOME = { sections: [{ id: 'live-ribbon', type: 'ribbon' }], announcement: {} } as unknown as ResolvedHome;
const DRAFT_HOME = {
  sections: [
    { id: 'draft-hero', type: 'hero', slides: [] },
    { id: 'draft-ribbon', type: 'ribbon' },
  ],
  announcement: {},
} as unknown as ResolvedHome;
const DRAFT_CHROME = { ...storefrontApi.FALLBACK_CHROME, shopName: 'Draft Name' } as ResolvedChrome;

function withQueryClient(extra?: (children: React.ReactNode) => React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    const inner = extra ? extra(children) : children;
    return <QueryClientProvider client={client}>{inner}</QueryClientProvider>;
  };
}

describe('storefront hooks and the draft preview', () => {
  const homeSpy = storefrontApi.fetchStorefrontHome as jest.Mock;
  const chromeSpy = storefrontApi.fetchStorefrontChrome as jest.Mock;

  beforeEach(() => {
    homeSpy.mockReset().mockResolvedValue(LIVE_HOME);
    chromeSpy.mockReset().mockResolvedValue(storefrontApi.FALLBACK_CHROME);
  });

  it('return the draft inside the preview and never fetch the live layout', async () => {
    const wrapper = withQueryClient((children) => (
      <StorefrontPreviewProvider value={{ home: DRAFT_HOME, chrome: DRAFT_CHROME }}>
        {children}
      </StorefrontPreviewProvider>
    ));
    const home = renderHook(() => useStorefrontHome(), { wrapper });
    const chrome = renderHook(() => useStorefrontChrome(), { wrapper });

    expect(home.result.current.data).toBe(DRAFT_HOME);
    expect(chrome.result.current.data?.shopName).toBe('Draft Name');
    await new Promise((r) => setTimeout(r, 20));
    expect(homeSpy).not.toHaveBeenCalled();
    expect(chromeSpy).not.toHaveBeenCalled();
  });

  it('fetch the live layout exactly as before on a live page', async () => {
    const { result } = renderHook(() => useStorefrontHome(), { wrapper: withQueryClient() });
    await waitFor(() => expect(result.current.data).toBe(LIVE_HOME));
    expect(homeSpy).toHaveBeenCalledTimes(1);
  });
});

describe('HomeView preview tags', () => {
  it('tags every section with its id inside the preview', () => {
    const { container } = render(
      <StorefrontPreviewProvider value={{ home: DRAFT_HOME, chrome: DRAFT_CHROME }}>
        <HomeView home={DRAFT_HOME} />
      </StorefrontPreviewProvider>,
    );
    const ids = Array.from(container.querySelectorAll('[data-preview-id]')).map((el) =>
      el.getAttribute('data-preview-id'),
    );
    expect(ids).toEqual(['draft-hero', 'draft-ribbon']);
  });

  it('renders no preview attribute on the live shop', () => {
    const { container } = render(<HomeView home={DRAFT_HOME} />);
    expect(container.querySelector('[data-preview-id]')).toBeNull();
    expect(container.innerHTML).not.toContain('data-preview-id');
  });
});
