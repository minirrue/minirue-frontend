import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import VariantPicker from '@/components/storefront/VariantPicker';
import { SitewideDiscountProvider } from '@/lib/hooks/use-sitewide-discount';
import { IN_STOCK_VARIANT, SOLD_OUT_VARIANT } from './fixtures/product';

let mockPercent: number | null = null;
jest.mock('@/lib/api/client', () => ({
  apiFetch: jest.fn(async () => ({ percent: mockPercent })),
}));

/**
 * A sold-out size used to be drawn with a strikethrough AND at 40% opacity —
 * two refusals stacked on top of each other, and the result was that neither
 * the size nor the price could be read. Say "no" once, legibly.
 */
describe('VariantPicker', () => {
  /**
   * frontend#184: a single, labelled variant used to render through the same
   * `<button>` as a multi-variant chip — filled solid when selected, exactly
   * like "Add to bag" one row down. A real shopper tapped it expecting to
   * buy and left when nothing happened.
   */
  it('a single variant renders as plain text, not a button', () => {
    render(
      <VariantPicker
        variants={[IN_STOCK_VARIANT]}
        isMinirueOwned
        selectedId={IN_STOCK_VARIANT.id}
        onChange={() => {}}
      />,
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText(/50\s*ML/i)).toBeInTheDocument();
  });

  it('keeps a sold-out size readable and says so in words', () => {
    render(
      <VariantPicker
        variants={[IN_STOCK_VARIANT, SOLD_OUT_VARIANT]}
        isMinirueOwned
        selectedId={IN_STOCK_VARIANT.id}
        onChange={() => {}}
      />,
    );

    const soldOutPill = screen.getByRole('button', { name: /100 ML/i });
    expect(soldOutPill).toBeDisabled();
    expect(soldOutPill).toHaveTextContent(/sold out/i);
    expect(soldOutPill).not.toHaveTextContent('700');
    expect(soldOutPill.style.textDecoration).not.toMatch(/line-through/);
  });

  it('still shows the price on a size that can be bought', () => {
    render(
      <VariantPicker
        variants={[IN_STOCK_VARIANT, SOLD_OUT_VARIANT]}
        isMinirueOwned
        selectedId={IN_STOCK_VARIANT.id}
        onChange={() => {}}
      />,
    );

    const sellablePill = screen.getByRole('button', { name: /50 ML/i });
    expect(sellablePill).toBeEnabled();
    expect(sellablePill).toHaveTextContent('400');
  });

  /**
   * #140: during a sale the pills printed the full price while the panel above
   * showed the discounted one — two prices for one size on one screen.
   */
  it('prices a pill by the running markdown, like the panel', async () => {
    mockPercent = 25;
    render(
      <SitewideDiscountProvider>
        <VariantPicker
          variants={[IN_STOCK_VARIANT, SOLD_OUT_VARIANT]}
          isMinirueOwned
          selectedId={IN_STOCK_VARIANT.id}
          onChange={() => {}}
        />
      </SitewideDiscountProvider>,
    );
    const pill = screen.getByRole('button', { name: /50 ML/i });
    await waitFor(() => expect(pill).toHaveTextContent('300'));
    mockPercent = null;
  });

  it("never cuts a partner's pill", async () => {
    mockPercent = 25;
    render(
      <SitewideDiscountProvider>
        <VariantPicker
          variants={[IN_STOCK_VARIANT, SOLD_OUT_VARIANT]}
          isMinirueOwned={false}
          selectedId={IN_STOCK_VARIANT.id}
          onChange={() => {}}
        />
      </SitewideDiscountProvider>,
    );
    const pill = screen.getByRole('button', { name: /50 ML/i });
    await waitFor(() => expect(pill).toHaveTextContent('400'));
    mockPercent = null;
  });
});
