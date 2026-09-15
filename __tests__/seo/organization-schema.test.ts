import { organizationSchema } from '@/components/seo/OrganizationSchema';

describe('OrganizationSchema', () => {
  it('serves Egypt only — the owner confirmed there is no delivery abroad (#146)', () => {
    expect(organizationSchema.areaServed).toEqual({ '@type': 'Country', name: 'Egypt' });
    expect(JSON.stringify(organizationSchema)).not.toMatch(/worldwide/i);
  });
});
