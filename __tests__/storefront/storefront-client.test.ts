import { fetchStorefrontHome, fetchStorefrontChrome, FALLBACK_CHROME } from '@/lib/api/storefront';

describe('fetchStorefrontHome', () => {
  afterEach(() => {
    (global.fetch as unknown as jest.Mock)?.mockReset?.();
  });

  it('calls the resolved home endpoint and returns the parsed body', async () => {
    const body = {
      sections: [],
      announcement: { enabled: true, messages: [], linkUrl: null, background: null },
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => body,
    }) as unknown as typeof fetch;

    const home = await fetchStorefrontHome();
    expect(home).toEqual(body);

    const [url] = (global.fetch as unknown as jest.Mock).mock.calls[0];
    expect(String(url)).toContain('/v1/storefront/home');
  });

  it('throws when the API responds with a non-OK status', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }) as unknown as typeof fetch;

    await expect(fetchStorefrontHome()).rejects.toThrow();
  });
});

describe('fetchStorefrontChrome', () => {
  afterEach(() => {
    (global.fetch as unknown as jest.Mock)?.mockReset?.();
  });

  it('calls the resolved chrome endpoint and returns the parsed body', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => FALLBACK_CHROME,
    }) as unknown as typeof fetch;

    const chrome = await fetchStorefrontChrome();
    expect(chrome).toEqual(FALLBACK_CHROME);

    const [url] = (global.fetch as unknown as jest.Mock).mock.calls[0];
    expect(String(url)).toContain('/v1/storefront/chrome');
  });

  it('throws when the API responds with a non-OK status', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
    }) as unknown as typeof fetch;

    await expect(fetchStorefrontChrome()).rejects.toThrow();
  });
});

describe('FALLBACK_CHROME', () => {
  it('renders an empty nav rather than inventing links', () => {
    expect(FALLBACK_CHROME.navbar.desktop).toEqual([]);
    expect(FALLBACK_CHROME.navbar.mobile).toEqual([]);
  });

  it('has no footer columns', () => {
    expect(FALLBACK_CHROME.footer.columns).toEqual([]);
  });
});
