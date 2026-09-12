import React from 'react';
import { render } from '@testing-library/react';
import SlideContent, { safeHexColor } from '@/components/storefront/SlideContent';
import type { ResolvedHeroSlide } from '@/lib/api/storefront';

/**
 * Admin-chosen hero colours.
 *
 * The load-bearing case is the one nobody looks at: a slide with NONE of the
 * six fields — every slide in production until someone opens a picker, and
 * every slide served from a storefront cache entry written before the fields
 * existed. That has to render byte-for-byte what it rendered yesterday, so the
 * "absent" tests assert the ORIGINAL literal colours are still on the elements
 * and that the CTA carries no inline style at all.
 */

function makeSlide(extra: Partial<ResolvedHeroSlide> = {}): ResolvedHeroSlide {
  return {
    id: 'slide-1',
    mode: 'editorial',
    eyebrow: 'EYEBROW',
    headline: 'Headline',
    sub: 'Sub',
    tagline: 'Tagline',
    imageUrl: null,
    mobileImageUrl: null,
    imageAlt: '',
    background: '#0B0B0B',
    bottle: null,
    cap: null,
    ctaLabel: 'Shop now',
    ctaTarget: { kind: 'scroll' },
    ctaHref: null,
    ...extra,
  };
}

function renderSlide(extra: Partial<ResolvedHeroSlide> = {}) {
  const { container } = render(
    <SlideContent slide={makeSlide(extra)} mobile={false} isActive />
  );
  const copy = container.querySelector('h1')!.parentElement!;
  return {
    container,
    eyebrow: copy.querySelector('div') as HTMLElement,
    headline: container.querySelector('h1') as HTMLElement,
    sub: container.querySelector('h2') as HTMLElement,
    tagline: container.querySelector('p') as HTMLElement,
    cta: container.querySelector('.mr-hero-cta') as HTMLElement,
  };
}

describe('safeHexColor', () => {
  it('accepts #abc and #aabbcc, either case', () => {
    expect(safeHexColor('#fff')).toBe('#fff');
    expect(safeHexColor('#A1B2C3')).toBe('#A1B2C3');
  });

  it('drops anything that is not a plain hex triple', () => {
    for (const bad of [
      'red',
      'javascript:alert(1)',
      '',
      '#12345',
      '#ggg',
      'rgb(1,2,3)',
      'var(--mr-gold-300)',
      '#fff;background:url(https://evil.test/x)',
      'red !important',
      'expression(alert(1))',
      null,
      undefined,
    ] as Array<string | null | undefined>) {
      expect(safeHexColor(bad)).toBeNull();
    }
  });
});

describe('SlideContent hero colours — absent is a no-op', () => {
  it('keeps every theme colour when no colour field is sent at all', () => {
    const { eyebrow, headline, sub, tagline, cta } = renderSlide();

    expect(eyebrow.style.color).toBe('rgba(238, 230, 209, 0.6)');
    expect(headline.style.color).toBe('var(--mr-cream-100)');
    expect(sub.style.color).toBe('var(--mr-gold-300)');
    expect(tagline.style.color).toBe('rgba(246, 242, 233, 0.6)');

    // Not "a style that happens to match" — no inline style on the pill at all.
    expect(cta.getAttribute('style')).toBeNull();
  });

  it('treats explicit nulls exactly like absent fields', () => {
    const { eyebrow, headline, sub, tagline, cta } = renderSlide({
      eyebrowColor: null,
      headlineColor: null,
      subColor: null,
      taglineColor: null,
      ctaBgColor: null,
      ctaTextColor: null,
    });

    expect(eyebrow.style.color).toBe('rgba(238, 230, 209, 0.6)');
    expect(headline.style.color).toBe('var(--mr-cream-100)');
    expect(sub.style.color).toBe('var(--mr-gold-300)');
    expect(tagline.style.color).toBe('rgba(246, 242, 233, 0.6)');
    expect(cta.getAttribute('style')).toBeNull();
  });
});

describe('SlideContent hero colours — set', () => {
  it('applies each colour to its own area', () => {
    const { eyebrow, headline, sub, tagline } = renderSlide({
      eyebrowColor: '#ff0000',
      headlineColor: '#00ff00',
      subColor: '#0000ff',
      taglineColor: '#ff00ff',
    });

    expect(eyebrow.style.color).toBe('rgb(255, 0, 0)');
    expect(headline.style.color).toBe('rgb(0, 255, 0)');
    expect(sub.style.color).toBe('rgb(0, 0, 255)');
    expect(tagline.style.color).toBe('rgb(255, 0, 255)');
  });

  it('keeps the headline text-shadow when a colour is set', () => {
    const { headline } = renderSlide({ headlineColor: '#00ff00' });
    expect(headline.style.textShadow).toBe('0 2px 24px rgba(0,0,0,0.35)');
  });

  it('colours one area without disturbing the others', () => {
    const { eyebrow, headline, sub, tagline } = renderSlide({ subColor: '#123456' });

    expect(sub.style.color).toBe('rgb(18, 52, 86)');
    expect(eyebrow.style.color).toBe('rgba(238, 230, 209, 0.6)');
    expect(headline.style.color).toBe('var(--mr-cream-100)');
    expect(tagline.style.color).toBe('rgba(246, 242, 233, 0.6)');
  });
});

describe('SlideContent hero colours — rejected values', () => {
  it.each(['red', 'javascript:alert(1)', '', 'rgb(1,2,3)'])(
    'ignores %p and falls back to the theme colour',
    (bad) => {
      const { eyebrow, headline, sub, tagline, cta } = renderSlide({
        eyebrowColor: bad,
        headlineColor: bad,
        subColor: bad,
        taglineColor: bad,
        ctaBgColor: bad,
        ctaTextColor: bad,
      });

      expect(eyebrow.style.color).toBe('rgba(238, 230, 209, 0.6)');
      expect(headline.style.color).toBe('var(--mr-cream-100)');
      expect(sub.style.color).toBe('var(--mr-gold-300)');
      expect(tagline.style.color).toBe('rgba(246, 242, 233, 0.6)');
      expect(cta.getAttribute('style')).toBeNull();
    }
  );

  it('never lets an unvalidated string reach the markup', () => {
    const payload = '#fff;background:url(https://evil.test/x)';
    const { container } = render(
      <SlideContent
        slide={makeSlide({ headlineColor: payload, ctaBgColor: payload, ctaTextColor: payload })}
        mobile={false}
        isActive
      />
    );
    expect(container.innerHTML).not.toContain('evil.test');
  });
});

describe('SlideContent hero CTA — both colours or neither', () => {
  it('applies the fill, the border and the label when both are set', () => {
    const { cta } = renderSlide({ ctaBgColor: '#123456', ctaTextColor: '#ffffff' });

    expect(cta.style.background).toBe('rgb(18, 52, 86)');
    expect(cta.style.borderColor).toBe('rgb(18, 52, 86)');
    expect(cta.style.color).toBe('rgb(255, 255, 255)');
  });

  it('points the hover sweep at the chosen fill so the label cannot vanish', () => {
    const { cta } = renderSlide({ ctaBgColor: '#123456', ctaTextColor: '#ffffff' });
    expect(cta.style.getPropertyValue('--sweep-color')).toBe('#123456');
  });

  it('ignores a background with no label colour — that is the invisible button', () => {
    const { cta } = renderSlide({ ctaBgColor: '#0b0b0b' });
    expect(cta.getAttribute('style')).toBeNull();
  });

  it('ignores a label colour with no background, for the same reason', () => {
    const { cta } = renderSlide({ ctaTextColor: '#fdfbf5' });
    expect(cta.getAttribute('style')).toBeNull();
  });

  it('ignores the pair when only one of the two survives validation', () => {
    const { cta } = renderSlide({ ctaBgColor: '#123456', ctaTextColor: 'white' });
    expect(cta.getAttribute('style')).toBeNull();
  });

  it('styles the link variant of the pill the same way', () => {
    const { container } = render(
      <SlideContent
        slide={makeSlide({
          ctaHref: '/shop',
          ctaBgColor: '#123456',
          ctaTextColor: '#ffffff',
        })}
        mobile={false}
        isActive
      />
    );
    const cta = container.querySelector('a.mr-hero-cta') as HTMLElement;
    expect(cta.style.background).toBe('rgb(18, 52, 86)');
    expect(cta.style.color).toBe('rgb(255, 255, 255)');
  });
});
