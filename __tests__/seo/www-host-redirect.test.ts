import nextConfig from '../../next.config';

/**
 * #155 — www.minirueshop.com served the site with 200, so the shop existed on
 * two hosts. Every www path must permanently redirect to the same path on the
 * apex, and that rule must come first so no other redirect answers www.
 */
describe('www host redirect', () => {
  it('308s every www path to the apex, before any other redirect', async () => {
    const redirects = (await nextConfig.redirects?.()) ?? [];
    expect(redirects[0]).toEqual({
      source: '/:path*',
      has: [{ type: 'host', value: 'www.minirueshop.com' }],
      destination: 'https://minirueshop.com/:path*',
      permanent: true,
    });
  });
});
