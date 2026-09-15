import {
  bundleSeoDescription,
  fitSeoTitle,
  SEO_DESCRIPTION_MAX,
  SEO_TITLE_MAX,
  spaceSeoDescription,
} from '@/lib/seo/page-seo';

/**
 * #155 — the live SEO audit warned on titles over 60 characters (17 of them,
 * up to 96) and on short or unnamed meta descriptions for sets and partner
 * pages. These are the pure rules behind the fixes.
 */

describe('fitSeoTitle', () => {
  it('keeps all three spellings when they fit', () => {
    expect(fitSeoTitle(['Plex Set'])).toBe('Plex Set | MiniRue (Mini Rue) · minirueshop');
  });

  it('shortens the suffix before touching the name', () => {
    expect(fitSeoTitle(['Karseell Collagen Hair Mask+Argan Oil Set'])).toBe(
      'Karseell Collagen Hair Mask+Argan Oil Set | MiniRue',
    );
  });

  it('tries the richer head with every suffix before falling back to the next head', () => {
    expect(fitSeoTitle(['PLEX Bond Repairing Oil. Step 7 — REVOX', 'PLEX Bond Repairing Oil. Step 7'])).toBe(
      'PLEX Bond Repairing Oil. Step 7 — REVOX | MiniRue (Mini Rue)',
    );
  });

  it('never drops the name or the brand, even when they run long', () => {
    const name = 'Karseell Collagen Hair Shampoo+Hair Conditioner Set for Salon';
    expect(fitSeoTitle([name])).toBe(`${name} | MiniRue`);
  });

  it('fits within 60 characters whenever the name leaves room for " | MiniRue"', () => {
    for (let n = 1; n <= SEO_TITLE_MAX - ' | MiniRue'.length; n++) {
      const name = 'x'.repeat(n);
      const t = fitSeoTitle([name]);
      expect(t.length).toBeLessThanOrEqual(SEO_TITLE_MAX);
      expect(t.startsWith(name)).toBe(true);
    }
    expect(fitSeoTitle(['PLEX Hair Rebuilding System Set for Salon & Home'])).toBe(
      'PLEX Hair Rebuilding System Set for Salon & Home | MiniRue',
    );
  });
});

describe('bundleSeoDescription', () => {
  const members = [{}, {}] as never[];

  it('names the set and carries the brand spellings, 50 to 155 characters', () => {
    const d = bundleSeoDescription({
      name: 'Karseell Collagen Hair Shampoo+Hair Conditioner Set',
      description: null,
      members,
    });
    expect(d).toContain('Karseell Collagen Hair Shampoo+Hair Conditioner Set');
    for (const s of ['MiniRue', 'Mini Rue', 'minirueshop']) expect(d).toContain(s);
    expect(d.length).toBeGreaterThanOrEqual(50);
    expect(d.length).toBeLessThanOrEqual(SEO_DESCRIPTION_MAX);
  });

  it('fits a long set description into the limit', () => {
    const d = bundleSeoDescription({
      name: 'Karseell Collagen Hair Mask+Argan Oil Set',
      description:
        'A two-step repair and shine ritual pairing a 500ml Collagen Hair Mask with lightweight 50ml Moroccan Argan Oil for softer, smoother, more radiant hair.',
      members,
    });
    expect(d.startsWith('Karseell Collagen Hair Mask+Argan Oil Set at MiniRue (Mini Rue)')).toBe(true);
    expect(d.length).toBeLessThanOrEqual(SEO_DESCRIPTION_MAX);
    expect(d).toMatch(/Shop at minirueshop\.com\.$/);
  });
});

describe('spaceSeoDescription', () => {
  it('extends a short tagline into a sentence naming the partner', () => {
    const d = spaceSeoDescription('Helia', 'Delicate. Elegant. Helia');
    expect(d).toBe(
      'Delicate. Elegant. Helia. Shop Helia at MiniRue (Mini Rue), in their own space on minirueshop.com.',
    );
    expect(d.length).toBeGreaterThanOrEqual(50);
  });

  it('keeps a real description as it is', () => {
    const own = 'Handmade silver jewellery from Alexandria, designed and finished in small batches.';
    expect(spaceSeoDescription('Helia', own)).toBe(own);
  });

  it('writes one when the partner has none', () => {
    expect(spaceSeoDescription('Helia', null)).toBe(
      'Shop Helia at MiniRue (Mini Rue), in their own space on minirueshop.com.',
    );
  });
});
