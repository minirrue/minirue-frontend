/**
 * Regression for frontend#164: the real httpOnly session can outlive the
 * non-secret `mr-auth` UI hint. A cold load must ask the server who is signed
 * in and re-create the hint when the server proves the session is valid.
 */
import { apiMe } from '@/lib/api/auth';
import {
  clearAuthFlag,
  isAuthenticated,
} from '@/lib/auth/tokens';

function response(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
  } as unknown as Response;
}

describe('missing auth hint with a valid server session', () => {
  const realFetch = global.fetch;

  beforeEach(() => {
    clearAuthFlag();
    jest.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = realFetch;
    clearAuthFlag();
  });

  it('self-heals on the first /auth/get-session response', async () => {
    expect(isAuthenticated()).toBe(false);
    const fetchMock = jest.fn().mockResolvedValue(
      response({
        user: {
          id: 'customer-164',
          email: 'shopper@example.com',
          name: 'Shopper',
          role: 'CUSTOMER',
        },
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(apiMe()).resolves.toMatchObject({
      userId: 'customer-164',
      email: 'shopper@example.com',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/get-session'),
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(isAuthenticated()).toBe(true);
  });

  it('does not turn an absent hint into a remembered hint', async () => {
    const writes: string[] = [];
    const proto = Object.getPrototypeOf(document) as object;
    const original = Object.getOwnPropertyDescriptor(proto, 'cookie');
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => original?.get?.call(document) ?? '',
      set: (value: string) => {
        writes.push(value);
        original?.set?.call(document, value);
      },
    });
    global.fetch = jest.fn().mockResolvedValue(
      response({ user: { id: 'customer-164', email: 'shopper@example.com' } }),
    ) as unknown as typeof fetch;

    await apiMe();

    const healed = [...writes].reverse().find((value) => value.startsWith('mr-auth='));
    expect(healed).toBeDefined();
    expect(healed).not.toContain('Max-Age');
  });
});
