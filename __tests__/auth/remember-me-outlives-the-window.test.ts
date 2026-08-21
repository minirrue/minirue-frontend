/**
 * "Remember me" changed the SESSION and not the UI.
 *
 * `markAuthenticated()` wrote the `mr-auth` hint with no Max-Age, which makes
 * it a browser-session cookie: it dies when the window closes, whatever the
 * shopper ticked. Better Auth's own session cookie honoured `rememberMe` and
 * survived, so after a restart the session was alive while the hint was gone —
 * the header rendered SIGN IN for someone who was signed in, and the proxy's
 * already-signed-in redirect stopped guarding /login, so signing in again
 * minted a second session on top of the live one.
 *
 * Reported 2026-08-21 ("ensure remember me works also").
 */
import {
  clearAuthFlag,
  isAuthenticated,
  markAuthenticated,
} from '@/lib/auth/tokens';

/** jsdom keeps no cookie attributes, so the written string is captured instead. */
function captureWrites(): { last: () => string } {
  let last = '';
  const proto = Object.getPrototypeOf(document) as object;
  const original = Object.getOwnPropertyDescriptor(proto, 'cookie');
  Object.defineProperty(document, 'cookie', {
    configurable: true,
    get: () => original?.get?.call(document) ?? '',
    set: (value: string) => {
      last = value;
      original?.set?.call(document, value);
    },
  });
  return { last: () => last };
}

describe('markAuthenticated', () => {
  beforeEach(() => {
    clearAuthFlag();
  });

  it('persists the hint past the window when remember me is ticked', () => {
    const writes = captureWrites();
    markAuthenticated(true);

    expect(writes.last()).toContain('Max-Age=604800');
    expect(isAuthenticated()).toBe(true);
  });

  it('leaves the hint session-scoped when remember me is not ticked', () => {
    const writes = captureWrites();
    markAuthenticated(false);

    expect(writes.last()).not.toContain('Max-Age');
    expect(isAuthenticated()).toBe(true);
  });

  it('does not downgrade a remembered hint when re-asserted with no argument', () => {
    // The re-assert in lib/api/client.ts runs after every successful
    // authenticated request and knows nothing about what was ticked. Before the
    // choice was recorded in the cookie value, the first such call after
    // sign-in quietly rewrote a remembered cookie as a session one.
    markAuthenticated(true);
    const writes = captureWrites();
    markAuthenticated();

    expect(writes.last()).toContain('Max-Age=604800');
  });

  it('does not invent a remembered hint when none was asked for', () => {
    markAuthenticated(false);
    const writes = captureWrites();
    markAuthenticated();

    expect(writes.last()).not.toContain('Max-Age');
  });

  it('still reads a pre-existing hint written before the value encoding', () => {
    document.cookie = 'mr-auth=1; path=/';
    expect(isAuthenticated()).toBe(true);
  });

  it('reads as signed out once cleared', () => {
    markAuthenticated(true);
    clearAuthFlag();
    expect(isAuthenticated()).toBe(false);
  });
});
