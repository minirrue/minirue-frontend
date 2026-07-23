import { render, screen } from '@testing-library/react';
import HomeView from '@/components/storefront/HomeView';
import type { ResolvedHome } from '@/lib/api/storefront';

const home = (sections: ResolvedHome['sections']): ResolvedHome => ({
  sections,
  announcement: { enabled: true, messages: [], linkUrl: null, background: null },
});

describe('HomeView', () => {
  it('renders sections in the order the API returned them', () => {
    render(
      <HomeView
        onSelect={() => {}}
        home={home([
          { id: 's1', type: 'ribbon', items: ['FIRST RIBBON'], speedSeconds: 38, surface: 'ink' },
          {
            id: 's2', type: 'productGrid', eyebrow: 'EYEBROW', title: 'SECOND GRID',
            display: 'products', viewAllHref: null, products: [], brands: [],
          },
        ])}
      />,
    );
    const html = document.body.innerHTML;
    expect(html.indexOf('FIRST RIBBON')).toBeLessThan(html.indexOf('SECOND GRID'));
  });

  it('renders nothing at all for an empty section list', () => {
    const { container } = render(<HomeView home={home([])} onSelect={() => {}} />);
    expect(container.querySelector('section')).toBeNull();
  });

  it('skips a ribbon with no phrases', () => {
    render(
      <HomeView
        onSelect={() => {}}
        home={home([{ id: 's1', type: 'ribbon', items: [], speedSeconds: 38, surface: 'ink' }])}
      />,
    );
    expect(screen.queryByRole('marquee')).toBeNull();
  });
});
