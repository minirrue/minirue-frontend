/**
 * Unit tests — lib/analytics/transport.ts
 * Covers: fetch-first, sendBeacon fallback when fetch throws, text/plain MIME.
 */
import { sendBeacon, sendFetch } from '@/lib/analytics/transport';
import type { AnalyticsCollectPayload } from '@/lib/analytics/events';

const payload: AnalyticsCollectPayload = {
  ver: 1,
  ctx: {},
  ev: [{ id: 'e1', n: 'ui_click', t: Date.now() }],
};

function clearVisitorCookies(): void {
  document.cookie = 'mr-vid-c=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
}

describe('lib/analytics/transport', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    clearVisitorCookies();
    window.localStorage.clear();
  });

  it('sendFetch posts JSON with credentials + keepalive and resolves true on ok', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;

    const ok = await sendFetch(payload);

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/v1/mr-signal');
    expect(init).toMatchObject({
      method: 'POST',
      keepalive: true,
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
    });
  });

  it('sends x-mr-vid from the mirror cookie when present (backend#224 / frontend#188)', async () => {
    document.cookie = 'mr-vid-c=b6f1c3f0-9a3b-4e3a-9a6c-1a2b3c4d5e6f';
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;

    await sendFetch(payload);

    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>)['x-mr-vid']).toBe(
      'b6f1c3f0-9a3b-4e3a-9a6c-1a2b3c4d5e6f',
    );
  });

  it('sends x-mr-vid from localStorage when no cookie is readable', async () => {
    window.localStorage.setItem('mr-vid', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;

    await sendFetch(payload);

    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>)['x-mr-vid']).toBe(
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    );
  });

  it('omits x-mr-vid for a genuinely fresh browser', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;

    await sendFetch(payload);

    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>)['x-mr-vid']).toBeUndefined();
  });

  it('falls back to sendBeacon when fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'));
    const beaconMock = jest.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'sendBeacon', {
      value: beaconMock,
      configurable: true,
    });

    const ok = await sendFetch(payload);

    expect(ok).toBe(true);
    expect(beaconMock).toHaveBeenCalledTimes(1);
  });

  it('sendBeacon uses a text/plain Blob, never any other MIME type', () => {
    const beaconMock = jest.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'sendBeacon', {
      value: beaconMock,
      configurable: true,
    });

    sendBeacon(payload);

    const [, blob] = beaconMock.mock.calls[0] as [string, Blob];
    expect(blob.type).toBe('text/plain');
  });

  it('sendBeacon returns false when sendBeacon is unavailable', () => {
    Object.defineProperty(navigator, 'sendBeacon', {
      value: undefined,
      configurable: true,
    });
    expect(sendBeacon(payload)).toBe(false);
  });
});
