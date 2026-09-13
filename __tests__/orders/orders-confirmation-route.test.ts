import { existsSync } from 'node:fs';
import { join } from 'node:path';
import nextConfig from '../../next.config';

/**
 * #121 — `/orders/[id]/confirmation` is gone, and its address forwards to the
 * order in the account.
 *
 * It was a Server Component calling `apiGetOrder`, whose success path runs the
 * client-only `markAuthenticated()`, so it threw on every order and printed
 * "We could not load your order details" even when the API answered 200. It
 * also ran on the storefront host, which never holds the shopper's httpOnly
 * API cookies, so a working call would have been refused anyway.
 *
 * Nothing has linked to it since checkout moved to /checkout/confirmation
 * (f44928d); no email or notification builds the URL. What an old link wants
 * — "show me that order" — is `/account/orders/[id]`, which fetches in the
 * browser with the shopper's session. Same id, so a redirect loses nothing.
 */
describe('/orders/[id]/confirmation', () => {
  it('has no page left to render', () => {
    expect(existsSync(join(process.cwd(), 'app/orders/[id]/confirmation/page.tsx'))).toBe(false);
  });

  it('redirects to the order in the account', async () => {
    const redirects = (await nextConfig.redirects?.()) ?? [];
    expect(redirects).toContainEqual(
      expect.objectContaining({
        source: '/orders/:id/confirmation',
        destination: '/account/orders/:id',
      }),
    );
  });
});
