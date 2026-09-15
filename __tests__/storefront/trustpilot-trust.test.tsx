/**
 * Unit tests — components/storefront/TrustpilotTrust.tsx (#156)
 * Covers: the profile link (clean URL, new tab, rel=noopener), the local
 * official logo, both variants, and honesty (no rating or score while
 * Trustpilot has no reviews).
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import TrustpilotTrust, { TRUSTPILOT_PROFILE_URL } from '@/components/storefront/TrustpilotTrust';

describe('TrustpilotTrust', () => {
  it.each(['compact', 'band'] as const)('%s links to the clean profile in a new tab', (variant) => {
    render(<TrustpilotTrust variant={variant} />);
    const link = screen.getByRole('link', { name: /review us on trustpilot/i });
    expect(TRUSTPILOT_PROFILE_URL).toBe('https://www.trustpilot.com/review/minirueshop.com');
    expect(link).toHaveAttribute('href', TRUSTPILOT_PROFILE_URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it.each(['compact', 'band'] as const)('%s shows the local Trustpilot logo and verified copy', (variant) => {
    const { container } = render(<TrustpilotTrust variant={variant} />);
    const logo = screen.getByRole('img', { name: 'Trustpilot' });
    expect(logo.getAttribute('src')).toContain('/brand/trustpilot-logo.svg');
    expect(container).toHaveTextContent(/verified business on trustpilot/i);
  });

  it('claims no rating, score or review count', () => {
    const { container } = render(<TrustpilotTrust variant="band" />);
    expect(container).not.toHaveTextContent(/excellent|\d(\.\d)? ?(\/ ?5|out of|stars?)|\d+ reviews?/i);
  });
});
