import { isPrivateOrderRoute } from '@/lib/privacy/private-order-route';
import { safeReturnPath } from '@/lib/auth/safe-return-path';

test('review tokens and auth return links are private', () => {
  expect(isPrivateOrderRoute('/booth/review/secret')).toBe(true);
  expect(isPrivateOrderRoute('/signup', '?next=%2Fbooth%2Freview%2Fsecret')).toBe(true);
  expect(isPrivateOrderRoute('/login', '?returnUrl=%2Fbooth%2Freview%2Fsecret')).toBe(true);
  expect(isPrivateOrderRoute('/shop', '?sort=price')).toBe(false);
});

test.each(['https://evil.test', '//evil.test', '/\\evil.test', '/\n/evil.test'])('rejects unsafe auth return %s', value => {
  expect(safeReturnPath(value)).toBe('/');
});

test('keeps a local receipt return path', () => {
  expect(safeReturnPath('/booth/review/opaque')).toBe('/booth/review/opaque');
});
