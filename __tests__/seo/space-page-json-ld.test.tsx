import React from 'react';
import { render } from '@testing-library/react';
import type { StorefrontSpaceDetail } from '@/lib/api/storefront';
import { SITE_URL } from '@/lib/seo/config';

/**
 * Task 9 — proves BreadcrumbSchema and SpaceOrganizationSchema are actually
 * wired into `/[slug]` and `/[slug]/[child]`, not just correct as pure
 * builder functions. Reads the emitted `<script type="application/ld+json">`
 * tags off the rendered tree, the same way a crawler would.
 *
 * No backend is reachable in this environment, so `fetchSpace`/`fetchSpaceChild`
 * are mocked — same approach as __tests__/storefront/space-child-brand.test.tsx.
 * `SpaceView` does its own async catalog fetch for the Generic bucket, which
 * isn't what's under test here, so it's stubbed to a plain marker.
 */

jest.mock('next/server', () => ({
  connection: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/components/layout/FooterWithSettings', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/layout/AnnouncementBar', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/app/products/HeaderWrapper', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/app/[slug]/SpaceView', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/lib/api/settings', () => ({
  apiGetPublicSettings: jest.fn().mockRejectedValue(new Error('no settings in test')),
}));

const fetchSpace = jest.fn();
const fetchStorefrontPage = jest.fn();
jest.mock('@/lib/api/storefront', () => {
  const actual = jest.requireActual('@/lib/api/storefront');
  return {
    ...actual,
    fetchSpace: (...args: unknown[]) => fetchSpace(...args),
    fetchStorefrontPage: (...args: unknown[]) => fetchStorefrontPage(...args),
  };
});

import StorefrontSlugPage from '@/app/[slug]/page';

function jsonLdNodes(container: HTMLElement): unknown[] {
  return Array.from(container.querySelectorAll('script[type="application/ld+json"]')).map(
    (el) => JSON.parse(el.innerHTML),
  );
}

const PARTNER_DETAIL: StorefrontSpaceDetail = {
  space: {
    id: 'space-1',
    slug: 'helia',
    name: 'Helia',
    kind: 'PARTNER',
    description: 'A jewellery atelier.',
    logoUrl: 'https://res.cloudinary.com/minirue/helia-logo.png',
  },
  categories: [],
  brands: [],
};

const HOUSE_DETAIL: StorefrontSpaceDetail = {
  space: {
    id: null,
    slug: 'minirue',
    name: 'MiniRue',
    kind: 'HOUSE',
    description: null,
    logoUrl: null,
  },
  categories: [],
  brands: [],
};

describe('/[slug] — BreadcrumbSchema + SpaceOrganizationSchema wiring (Task 9)', () => {
  beforeEach(() => {
    fetchSpace.mockReset();
    fetchStorefrontPage.mockReset();
  });

  it('emits a BreadcrumbList reading Home / {space}, and an Organization node for a PARTNER space', async () => {
    fetchSpace.mockResolvedValue(PARTNER_DETAIL);
    const el = await StorefrontSlugPage({ params: Promise.resolve({ slug: 'helia' }) });
    const { container } = render(el);
    const nodes = jsonLdNodes(container);

    const breadcrumb = nodes.find((n) => (n as { '@type'?: string })['@type'] === 'BreadcrumbList') as {
      itemListElement: Array<{ name: string; item: string }>;
    };
    expect(breadcrumb.itemListElement.map((i) => i.name)).toEqual(['Home', 'Helia']);
    expect(breadcrumb.itemListElement[1].item).toBe(`${SITE_URL}/helia`);

    const org = nodes.find((n) => (n as { '@type'?: string })['@type'] === 'Organization') as
      | { name: string; url: string; description: string; logo: string; image: string }
      | undefined;
    expect(org).toBeDefined();
    expect(org).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Helia',
      url: `${SITE_URL}/helia`,
      description: 'A jewellery atelier.',
      logo: 'https://res.cloudinary.com/minirue/helia-logo.png',
      image: 'https://res.cloudinary.com/minirue/helia-logo.png',
    });
    expect(org).not.toHaveProperty('sameAs');
  });

  it('emits a BreadcrumbList for a HOUSE space but never a competing Organization node', async () => {
    fetchSpace.mockResolvedValue(HOUSE_DETAIL);
    const el = await StorefrontSlugPage({ params: Promise.resolve({ slug: 'minirue' }) });
    const { container } = render(el);
    const nodes = jsonLdNodes(container);

    const breadcrumb = nodes.find((n) => (n as { '@type'?: string })['@type'] === 'BreadcrumbList') as {
      itemListElement: Array<{ name: string }>;
    };
    expect(breadcrumb.itemListElement.map((i) => i.name)).toEqual(['Home', 'MiniRue']);

    const org = nodes.find((n) => (n as { '@type'?: string })['@type'] === 'Organization');
    expect(org).toBeUndefined();
  });
});
