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

describe('lib/analytics/transport', () => {
  afterEach(() => {
    jest.restoreAllMocks();
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
