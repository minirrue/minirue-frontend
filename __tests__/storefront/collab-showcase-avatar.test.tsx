import React from 'react';
import { render, screen } from '@testing-library/react';
import CollabShowcase from '@/components/storefront/CollabShowcase';
import type { ResolvedSection } from '@/lib/api/storefront';

/**
 * The owner has reported first-letter avatars four separate times. Every other
 * avatar slot in the storefront already had a regression test; this one did
 * not, which is exactly why the monogram survived here — a 56px circle
 * rendering `tab.label.charAt(0)` when a collaborator had no logo.
 *
 * The rule these tests lock in: a real logo when one exists, the shared
 * GenericAvatarIcon silhouette when it does not, and never an initial letter.
 */
jest.mock('@/lib/hooks/useBreakpoint', () => ({
  useBreakpoint: () => ({ mobile: false, tablet: false, desktop: true }),
}));

type Section = Extract<ResolvedSection, { type: 'collabShowcase' }>;

function section(logoUrl: string | null): Section {
  return {
    id: 'section-1',
    type: 'collabShowcase',
    eyebrow: 'Partners',
    title: 'In collaboration',
    tabs: [
      {
        collaboratorId: 'c1',
        label: 'Velvet Noir',
        brandSlug: 'velvet-noir',
        logoUrl,
        description: null,
        products: [],
      },
    ],
  };
}

describe('CollabShowcase collaborator avatar', () => {
  it('shows the generic person icon, not an initial letter, when there is no logo', () => {
    render(<CollabShowcase section={section(null)} />);

    expect(screen.getByTestId('avatar-generic')).toBeInTheDocument();
    // The name still appears as the heading, but nowhere as a lone letter.
    const lonelyLetters = screen
      .queryAllByText('V')
      .filter((el) => el.textContent?.trim() === 'V');
    expect(lonelyLetters).toHaveLength(0);
  });

  it('shows the real logo and no generic icon when a logo exists', () => {
    const { container } = render(
      <CollabShowcase section={section('https://cdn.example/logo.png')} />,
    );

    expect(container.querySelector('img[src="https://cdn.example/logo.png"]')).not.toBeNull();
    expect(screen.queryByTestId('avatar-generic')).toBeNull();
  });
});
