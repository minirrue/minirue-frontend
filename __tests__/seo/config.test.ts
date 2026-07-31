/**
 * lib/seo/config.ts exports SITE_URL as a module-level const, evaluated once
 * at import time from `process.env.NEXT_PUBLIC_SITE_URL`. To exercise each
 * env-var scenario we have to reset the module registry and re-import fresh
 * for every case — mutating process.env and re-reading the already-imported
 * SITE_URL would just observe the same cached value every time.
 */
describe('lib/seo/config SITE_URL', () => {
  const ORIGINAL_ENV = process.env.NEXT_PUBLIC_SITE_URL;

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL_ENV;
    }
  });

  async function loadSiteUrl(envValue: string | undefined): Promise<string> {
    if (envValue === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = envValue;
    }
    jest.resetModules();
    const { SITE_URL } = await import('@/lib/seo/config');
    return SITE_URL;
  }

  it('defaults to https://minirueshop.com when the env var is unset', async () => {
    expect(await loadSiteUrl(undefined)).toBe('https://minirueshop.com');
  });

  it('strips a single trailing slash', async () => {
    expect(await loadSiteUrl('https://minirueshop.com/')).toBe('https://minirueshop.com');
  });

  it('strips multiple trailing slashes (the regex is greedy by design)', async () => {
    expect(await loadSiteUrl('https://minirueshop.com///')).toBe('https://minirueshop.com');
  });

  it('leaves a bare origin (no trailing slash) unchanged', async () => {
    expect(await loadSiteUrl('https://staging.minirueshop.com')).toBe(
      'https://staging.minirueshop.com',
    );
  });
});
