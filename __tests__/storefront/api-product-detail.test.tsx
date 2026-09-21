import React from 'react';
import { render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ApiProductDetail from '@/components/storefront/ApiProductDetail';
import { PRODUCT_FIXTURE } from './fixtures/product';

// The page saves favourites and reads reviews through React Query, and sends a
// signed-out visitor to /login, so it needs both a client and a router.
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
}));

function render(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return rtlRender(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

/**
 * The bug this file locks down: BackButton and InfoPanel used to be declared
 * INSIDE ApiProductDetail's body, so every render created a new component type.
 * React tears down a subtree whose type changed, and the freshly mounted nodes
 * re-run their CSS entrance keyframes — which is why tapping the heart replayed
 * "BILLIE EILLISH / No.1 / EGP 400 / ML / 50 ML · EGP 400 / OUT OF STOCK".
 *
 * Comparing DOM node identity is the honest assertion: same object means React
 * re-rendered in place; a different object means it remounted.
 */

function renderDetail() {
  return render(
    <ApiProductDetail
      product={PRODUCT_FIXTURE}
      perks={[]}
      onBack={() => {}}
      onAddToBag={() => {}}
    />,
  );
}

/**
 * The buy button and the heart each appear twice — once in the copy column and
 * once in the sticky bar — and CSS shows one or the other by width. Queries
 * here name which copy they mean rather than guessing.
 */
function byTrace(traceId: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(`[data-trace-id="${traceId}"]`);
  if (!el) throw new Error(`No element with trace id ${traceId}`);
  return el;
}

describe('ApiProductDetail', () => {
  it('does not remount the info panel when the wishlist heart is tapped', async () => {
    renderDetail();
    const panelBefore = screen.getByTestId('product-info-panel');
    const titleBefore = screen.getByTestId('product-title');

    await userEvent.click(
      byTrace('PG-STOREFRONT-CAT-005::EL-BTN-toggle-wishlist'),
    );

    expect(screen.getByTestId('product-info-panel')).toBe(panelBefore);
    expect(screen.getByTestId('product-title')).toBe(titleBefore);
  });

  it('does not remount the info panel when a size is added to the bag', async () => {
    renderDetail();
    const panelBefore = screen.getByTestId('product-info-panel');
    const titleBefore = screen.getByTestId('product-title');

    await userEvent.click(byTrace('PG-STOREFRONT-CAT-005::EL-BTN-add-to-bag'));

    expect(screen.getByTestId('product-info-panel')).toBe(panelBefore);
    expect(screen.getByTestId('product-title')).toBe(titleBefore);
  });

  it('keeps a buy button under the thumb on a phone', () => {
    renderDetail();
    const bar = screen.getByTestId('buy-bar');

    // Sticky rather than fixed, so it sits in the flow and cannot cover the
    // end of the page; hidden on a laptop, where the copy column is pinned
    // already and this would be a second button saying the same thing.
    expect(bar.className).toContain('sticky');
    expect(bar.className).toContain('lg:hidden');
    expect(
      byTrace('PG-STOREFRONT-CAT-005::EL-BTN-add-to-bag-sticky'),
    ).toBeInTheDocument();
  });

  it('ends the page on the closing photograph and not on a sizes panel', () => {
    renderDetail();
    // The fixture marks no closing image, so neither should be there.
    expect(screen.queryByText(/available sizes/i)).toBeNull();
    expect(
      document.querySelector(
        '[data-trace-id="PG-STOREFRONT-CAT-005::EL-IMG-product-closing-image"]',
      ),
    ).toBeNull();
  });

  it('does not remount the info panel when a different size is picked', async () => {
    renderDetail();
    const panelBefore = screen.getByTestId('product-info-panel');

    // 50 ML is selected by default; picking it again still re-renders the tree.
    await userEvent.click(screen.getByRole('button', { name: /50 ML/i }));

    expect(screen.getByTestId('product-info-panel')).toBe(panelBefore);
  });

  it('renders exactly one product tree at any viewport, laid out by CSS', () => {
    const { container } = renderDetail();

    expect(container.querySelectorAll('[data-testid="product-info-panel"]')).toHaveLength(1);
    // The desktop split is a CSS concern now — no JS width branch, so no
    // phone-tree-then-desktop-tree double mount for desktop visitors.
    expect(container.querySelector('[data-testid="product-layout"]')).toHaveClass('lg:flex-row');
  });

  /**
   * Bug 2 (task-storefront-bugs): "What people say" used to render before the
   * product details (brand/name/price/size picker/Add to bag) on a phone —
   * both lived inside the SAME `order-2` flex item, ahead of <aside>'s
   * `order-3`. The fix keeps <ProductReviews> mounted once (it fetches its
   * own data) but moves it into its own `order-4` flex item via a `contents`
   * wrapper, so on mobile it now falls after <aside> in flex order. `order`
   * only reorders visually/for CSS layout, not DOM position — so the
   * meaningful assertion is each element's actual mobile `order` class,
   * which is what the CSS cascade in the deployed build acts on.
   */
  it('gives the product info panel a lower mobile order than the reviews section, so details render before reviews', () => {
    const { container } = renderDetail();

    const infoPanel = container.querySelector('[data-testid="product-info-panel"]');
    // <aside> is the flex item that actually carries the mobile `order`
    // class; the info panel is a plain div inside it.
    const infoPanelFlexItem = infoPanel?.closest('aside');
    // The reviews SLOT, not the reviews content. <ProductReviews> now renders
    // nothing at all for a product with no reviews that this visitor cannot
    // review — which is every product in the fixture — so keying off the inner
    // section made this ordering test depend on whether there happened to be a
    // review. The flex item that carries the mobile `order` class is the
    // wrapper, and it is always present; ordering is what this test is about.
    const reviewsFlexItem = container.querySelector(
      '[data-testid="product-reviews-dwell-region"]',
    );

    expect(infoPanelFlexItem).toBeTruthy();
    expect(reviewsFlexItem).toBeTruthy();

    const orderClass = (el: Element | null | undefined) =>
      Array.from(el?.classList ?? []).find((c) => /^order-\d+$/.test(c));

    const infoOrder = Number(orderClass(infoPanelFlexItem)?.replace('order-', ''));
    const reviewsOrder = Number(orderClass(reviewsFlexItem)?.replace('order-', ''));

    expect(Number.isNaN(infoOrder)).toBe(false);
    expect(Number.isNaN(reviewsOrder)).toBe(false);
    expect(infoOrder).toBeLessThan(reviewsOrder);
  });

  it('places reviews after the product info panel in mobile visual order', () => {
    // Belt-and-suspenders on top of the specific-ancestor assertion above:
    // walk UP from each element to the nearest ancestor actually carrying a
    // mobile `order-N` class — the flex item CSS acts on — regardless of how
    // many plain wrapper divs (like the reviews block's `contents` parent)
    // sit in between, and confirm the info panel's item sorts before the
    // reviews item.
    const { container } = renderDetail();

    const infoPanel = container.querySelector('[data-testid="product-info-panel"]');
    // The slot, not the content — see the note in the test above. A product
    // with no reviews renders no reviews section, so the ordering invariant
    // has to be anchored on the flex item that always exists.
    const reviewsSection = container.querySelector(
      '[data-testid="product-reviews-dwell-region"]',
    );

    const orderOf = (descendant: Element | null): number => {
      let node: Element | null = descendant;
      while (node) {
        const cls = Array.from(node.classList).find((c) => /^order-\d+$/.test(c));
        if (cls) return Number(cls.replace('order-', ''));
        node = node.parentElement;
      }
      return NaN;
    };

    const infoOrder = orderOf(infoPanel);
    const reviewsOrder = orderOf(reviewsSection);

    expect(Number.isNaN(infoOrder)).toBe(false);
    expect(Number.isNaN(reviewsOrder)).toBe(false);
    expect(infoOrder).toBeLessThan(reviewsOrder);
  });

  /**
   * Owner, 2026-09-21: "on phone and tablet, image then this section —
   * Arencia / title / EGP 1,139 / In stock / perks / Size".
   *
   * The description (EditorialMoment) used to sit inside the same `order-2`
   * item as the photographs, so on a phone it fell BETWEEN the picture and
   * the buying controls — a full-screen dark block standing between a
   * visitor and the Add to bag button. 52 product views produced zero adds
   * to bag (frontend#189); this is one of the few structural reasons a
   * visitor would never reach the control at all.
   */
  it('puts the description AFTER the product details on a phone, not between photo and buy', () => {
    const { container } = renderDetail();

    const orderOf = (descendant: Element | null): number => {
      let node: Element | null = descendant;
      while (node) {
        const cls = Array.from(node.classList).find((c) => /^order-\d+$/.test(c));
        if (cls) return Number(cls.replace('order-', ''));
        node = node.parentElement;
      }
      return NaN;
    };

    const gallery = container.querySelector('[data-testid="product-image-dwell-region"]');
    const infoPanel = container.querySelector('[data-testid="product-title"]');
    const description = container.querySelector(
      '[data-trace-id="PG-STOREFRONT-CAT-005::EL-REGION-product-description"]',
    );

    expect(gallery).toBeTruthy();
    expect(infoPanel).toBeTruthy();
    expect(description).toBeTruthy();

    const galleryOrder = orderOf(gallery);
    const infoOrder = orderOf(infoPanel);
    const descriptionOrder = orderOf(description);

    for (const n of [galleryOrder, infoOrder, descriptionOrder]) {
      expect(Number.isNaN(n)).toBe(false);
    }

    // photo -> details -> description, in that order.
    expect(galleryOrder).toBeLessThan(infoOrder);
    expect(infoOrder).toBeLessThan(descriptionOrder);
  });

  it('centres the description text under the centred quote', () => {
    render(
      <ApiProductDetail
        product={{ ...PRODUCT_FIXTURE, description: 'First paragraph.\n\nSecond paragraph.' }}
        perks={[]}
        onBack={() => {}}
        onAddToBag={() => {}}
      />,
    );
    const region = byTrace('PG-STOREFRONT-CAT-005::EL-REGION-product-description');
    expect(region.style.textAlign).toBe('center');
  });
});
