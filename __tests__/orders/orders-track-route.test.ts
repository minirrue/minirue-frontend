import { existsSync } from 'node:fs';
import { join } from 'node:path';
import nextConfig from '../../next.config';

/**
 * #125 — `/orders/[id]/track` is gone, and its address forwards to the order in
 * the account, which now shows the order's progress.
 *
 * It was a Server Component calling `apiGetOrder` and the shipment route with
 * `auth: true`. On the storefront host it never had the shopper's httpOnly API
 * cookies, and on success `apiFetch` calls the client-only
 * `markAuthenticated()`, which throws on the server — so every order read "We
 * could not find that order".
 *
 * Nothing links to it: its only link was the confirmation page #121 removed;
 * the footer's "Track order" goes to /account/orders; backend notification
 * links are dashboard paths; no email or SMS builds the URL. Same id, so a
 * redirect loses nothing.
 */
describe('/orders/[id]/track', () => {
  it('has no page left to render', () => {
    expect(existsSync(join(process.cwd(), 'app/orders/[id]/track/page.tsx'))).toBe(false);
  });

  it('redirects to the order in the account', async () => {
    const redirects = (await nextConfig.redirects?.()) ?? [];
    expect(redirects).toContainEqual(
      expect.objectContaining({
        source: '/orders/:id/track',
        destination: '/account/orders/:id',
        permanent: true,
      }),
    );
  });
});
