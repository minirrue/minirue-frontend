import { buildSpaceOrganizationSchema } from '@/components/seo/SpaceOrganizationSchema';
import type { StorefrontSpace } from '@/lib/api/storefront';
import { SITE_URL } from '@/lib/seo/config';

/**
 * buildSpaceOrganizationSchema is a pure function of a StorefrontSpace — no
 * fetch, no React — so it's unit-testable directly against fixtures, the same
 * approach __tests__/seo/collection-schema.test.ts and product-schema.test.ts
 * use for their builders.
 *
 * `StorefrontSpace` (lib/api/storefront.ts) provides only id, slug, name,
 * kind, description and logoUrl — no partner website, social or contact
 * field. These tests pin that the builder never fabricates one, in
 * particular never stubs an empty `sameAs`.
 */
describe('buildSpaceOrganizationSchema', () => {
  const HELIA: StorefrontSpace = {
    id: 'space-1',
    slug: 'helia',
    name: 'Helia',
    kind: 'PARTNER',
    description: 'A jewellery atelier.',
    logoUrl: 'https://res.cloudinary.com/minirue/helia-logo.png',
  };

  it('builds an Organization node with @id, name, description, logo, image and url — nothing else', () => {
    const schema = buildSpaceOrganizationSchema(HELIA);
    expect(schema).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': `${SITE_URL}/helia#organization`,
      name: 'Helia',
      url: `${SITE_URL}/helia`,
      description: 'A jewellery atelier.',
      logo: 'https://res.cloudinary.com/minirue/helia-logo.png',
      image: 'https://res.cloudinary.com/minirue/helia-logo.png',
    });
  });

  it('gives the partner Organization an addressable @id, so a same-page CollectionPage can reference it via `about`', () => {
    const schema = buildSpaceOrganizationSchema(HELIA) as { '@id': string };
    expect(schema['@id']).toBe(`${SITE_URL}/helia#organization`);
  });

  it('never emits sameAs — not present, not an empty array', () => {
    const schema = buildSpaceOrganizationSchema(HELIA);
    expect(schema).not.toHaveProperty('sameAs');
  });

  it('uses logoUrl as-is for both logo and image, never prefixed with SITE_URL (it is already absolute)', () => {
    const schema = buildSpaceOrganizationSchema(HELIA) as { logo: string; image: string };
    expect(schema.logo).toBe(HELIA.logoUrl);
    expect(schema.image).toBe(HELIA.logoUrl);
    expect(schema.logo.startsWith(SITE_URL)).toBe(false);
  });

  it('omits description when null, rather than emitting description: null', () => {
    const schema = buildSpaceOrganizationSchema({ ...HELIA, description: null });
    expect(schema).not.toHaveProperty('description');
  });

  it('omits logo and image when logoUrl is null', () => {
    const schema = buildSpaceOrganizationSchema({ ...HELIA, logoUrl: null });
    expect(schema).not.toHaveProperty('logo');
    expect(schema).not.toHaveProperty('image');
  });

  it('builds url as ${SITE_URL}/${slug}, never a house-style root URL', () => {
    const schema = buildSpaceOrganizationSchema(HELIA) as { url: string };
    expect(schema.url).toBe(`${SITE_URL}/helia`);
  });

  it('renders down to a minimal node with only @id/name/url when description and logoUrl are both null', () => {
    const schema = buildSpaceOrganizationSchema({ ...HELIA, description: null, logoUrl: null });
    expect(schema).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': `${SITE_URL}/helia#organization`,
      name: 'Helia',
      url: `${SITE_URL}/helia`,
    });
  });
});
