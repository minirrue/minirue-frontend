import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProductGallery from '@/components/storefront/ProductGallery';
import { carouselMedia } from '@/lib/api/catalog';
import { PRODUCT_FIXTURE } from './fixtures/product';

/**
 * Before this, a phone got a scroll-snap strip with nothing on screen to say a
 * second photograph existed, and a laptop got a stack of full-height slabs.
 */
describe('ProductGallery', () => {
  const items = carouselMedia(PRODUCT_FIXTURE);

  it('renders one slide and one dot per photograph', () => {
    render(<ProductGallery product={PRODUCT_FIXTURE} items={items} />);

    expect(items).toHaveLength(3);
    expect(screen.getAllByRole('img')).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: /go to photo/i })).toHaveLength(3);
  });

  it('starts on the cover and says which photograph you are on', () => {
    render(<ProductGallery product={PRODUCT_FIXTURE} items={items} />);

    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go to photo 1 of 3/i })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('moves to the photograph whose dot was pressed', async () => {
    render(<ProductGallery product={PRODUCT_FIXTURE} items={items} />);

    await userEvent.click(screen.getByRole('button', { name: /go to photo 3 of 3/i }));

    expect(screen.getByText('3 / 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go to photo 3 of 3/i })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('shows no dots, counter or arrows for a product with one photograph', () => {
    render(<ProductGallery product={PRODUCT_FIXTURE} items={[items[0]]} />);

    expect(screen.queryByRole('button', { name: /go to photo/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /next slide/i })).toBeNull();
    expect(screen.queryByText(/1 \/ 1/)).toBeNull();
  });
});
