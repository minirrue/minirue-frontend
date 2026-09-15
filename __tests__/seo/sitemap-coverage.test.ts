/**
 * @jest-environment node
 */

/**
 * #155 — the live SEO audit found every public set missing from sitemap.xml,
 * and /helia listed although it 308s to /collab/helia, whose canonical then
 * disagreed with the sitemap. The sitemap must list sets and the partner's
 * canonical address.
 */

jest.mock('@/lib/api/catalog', () => ({
  ...jest.requireActual('@/lib/api/catalog'),
  catalog: {
    listProducts: jest.fn().mockResolvedValue({ data: [], meta: { hasMore: false, cursor: null } }),
    listCategories: jest.fn().mockResolvedValue([]),
    search: jest.fn().mockResolvedValue({ data: [], meta: { total: 0, hasMore: false, cursor: null } }),
  },
}));
jest.mock('@/lib/api/storefront', () => ({
  fetchSpaces: jest.fn().mockResolvedValue([
    { slug: '', name: 'MiniRue', kind: 'HOUSE' },
    { slug: 'helia', name: 'Helia', kind: 'PARTNER' },
  ]),
  fetchSpace: jest.fn().mockResolvedValue({ categories: [{ slug: 'jewellery' }] }),
}));
jest.mock('@/lib/api/bundles', () => ({
  listBundles: jest.fn().mockResolvedValue([
    { slug: 'karseell-collagen-hair-mask-argan-oil-set', name: 'Karseell Collagen Hair Mask+Argan Oil Set' },
  ]),
}));

import sitemap from '@/app/sitemap';
import { SITE_URL } from '@/lib/seo/config';

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('sitemap coverage (#155)', () => {
  it('lists every public set with a lastmod', async () => {
    const entries = await sitemap();
    const set = entries.find((e) => e.url === `${SITE_URL}/bundles/karseell-collagen-hair-mask-argan-oil-set`);
    expect(set).toBeDefined();
    expect(set!.lastModified).toBeInstanceOf(Date);
  });

  it('lists a partner at its canonical /collab address, never the root redirect', async () => {
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toContain(`${SITE_URL}/collab/helia`);
    expect(urls).toContain(`${SITE_URL}/collab/helia/jewellery`);
    expect(urls).not.toContain(`${SITE_URL}/helia`);
    expect(urls).not.toContain(`${SITE_URL}/helia/jewellery`);
  });
});
