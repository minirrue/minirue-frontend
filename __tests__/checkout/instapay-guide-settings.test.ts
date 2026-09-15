import {
  DEFAULT_INSTAPAY_GUIDE,
  loadInstapayGuide,
  resolveInstapayGuide,
} from '@/lib/api/settings';

/**
 * #147 — the InstaPay step showed only a receipt upload. The guide reads
 * `payments.instapay` from `/settings/public` (minirue-backend#170), and every
 * field falls back to the bundled default, so the page works before and after
 * the backend ships.
 */
describe('resolveInstapayGuide', () => {
  it('uses the bundled defaults when there is no payments block', () => {
    expect(resolveInstapayGuide({})).toEqual(DEFAULT_INSTAPAY_GUIDE);
    expect(resolveInstapayGuide({ payments: null })).toEqual(DEFAULT_INSTAPAY_GUIDE);
    expect(resolveInstapayGuide({ payments: { codMaxOrderMinor: null } })).toEqual(
      DEFAULT_INSTAPAY_GUIDE,
    );
  });

  it('pins the owner defaults', () => {
    expect(DEFAULT_INSTAPAY_GUIDE).toEqual({
      payLink: 'https://ipn.eg/S/rueragab/instapay/2XqchK',
      handle: 'rueragab@instapay',
      qrUrl: '/instapay/instapay-qr.png',
      exampleUrl: '/instapay/instapay-example.png',
    });
  });

  it('falls back field by field on null, blank or unsafe values', () => {
    const guide = resolveInstapayGuide({
      payments: {
        instapay: {
          payLink: 'javascript:alert(1)',
          handle: '   ',
          qrMediaUrl: null,
          exampleMediaUrl: 'https://img.minirueshop.com/example.webp',
        },
      },
    });
    expect(guide).toEqual({
      ...DEFAULT_INSTAPAY_GUIDE,
      exampleUrl: 'https://img.minirueshop.com/example.webp',
    });
  });

  it('lets settings values override every default', () => {
    expect(
      resolveInstapayGuide({
        payments: {
          instapay: {
            payLink: 'https://ipn.eg/S/other/instapay/abc',
            handle: ' other@instapay ',
            qrMediaUrl: 'https://img.minirueshop.com/qr.png',
            exampleMediaUrl: 'https://storage.minirueshop.com/ex.png',
          },
        },
      }),
    ).toEqual({
      payLink: 'https://ipn.eg/S/other/instapay/abc',
      handle: 'other@instapay',
      qrUrl: 'https://img.minirueshop.com/qr.png',
      exampleUrl: 'https://storage.minirueshop.com/ex.png',
    });
  });
});

describe('loadInstapayGuide', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('returns the defaults when the settings read fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;
    await expect(loadInstapayGuide()).resolves.toEqual(DEFAULT_INSTAPAY_GUIDE);
  });

  it('reads payments.instapay from /settings/public', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ payments: { instapay: { handle: 'shop@instapay' } } }),
    }) as unknown as typeof fetch;
    await expect(loadInstapayGuide()).resolves.toEqual({
      ...DEFAULT_INSTAPAY_GUIDE,
      handle: 'shop@instapay',
    });
  });
});
