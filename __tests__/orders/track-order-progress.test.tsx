import fs from 'node:fs';
import path from 'node:path';

/**
 * The tracking page says something true (#60).
 *
 * The confirmation page links every customer to `/orders/{id}/track`, and that
 * page's carrier view is for a future that has not arrived: MiniRue has no
 * shipping-service integration — the dashboard's own panel says so, with every
 * control disabled — so no `fulfillment_shipments` row is ever created.
 *
 * With no shipment it used to render one sentence, for every order, forever:
 *
 *     "Your order has been received and is being prepared for shipment.
 *      Tracking information will appear here once your order ships."
 *
 * True on the day the order is placed. A lie once it has been delivered, and
 * still shown to somebody whose order was cancelled a week ago.
 *
 * The order's own status was already fetched on that page and used for nothing
 * but printing the order number. It is the progress now.
 *
 * ## Why this reads the source
 *
 * The page is an async server component that awaits two API calls at module
 * scope. Rendering it in jsdom means mocking `next/headers`, the fetch client
 * and the auth cookie to assert four `<li>` elements — machinery that would
 * then need maintaining, to check something structural.
 *
 * So this asserts the structure directly. It is a weaker test than a render,
 * and it is honest about being one: what it can catch is the page silently
 * going back to a hardcoded sentence, or losing the accessible state, which is
 * exactly the regression worth catching.
 */

const PAGE = fs.readFileSync(
  path.join(process.cwd(), 'app/orders/[id]/track/page.tsx'),
  'utf8',
);

/**
 * The page with block comments removed.
 *
 * The old copy is quoted in the component's own comment, because the reason it
 * changed is worth keeping — so "is this string still in the file" is the wrong
 * question. "Is it still RENDERED" is the right one.
 */
const PAGE_CODE = PAGE.replace(/\/\*[\s\S]*?\*\//g, '');

const CSS = fs.readFileSync(
  path.join(process.cwd(), 'app/styles/mr-tokens.css'),
  'utf8',
);

describe('the no-shipment branch', () => {
  it('renders the order progress rather than a fixed sentence', () => {
    expect(PAGE).toContain('{!shipment && <OrderProgress order={order} />}');
  });

  it('no longer RENDERS the claim that tracking will appear once it ships', () => {
    // The specific untruth. Kept as its own assertion so a revert is obvious in
    // the diff rather than buried in a structural check — and checked against
    // the code rather than the file, because the sentence is deliberately
    // quoted in the comment that explains why it went.
    expect(PAGE_CODE).not.toContain('Tracking information will appear here');
    expect(PAGE).toContain('Tracking information will appear here');
  });

  it('uses the order status it already fetched', () => {
    // `order` was fetched and used only for the order number. If someone
    // removes the fetch as "unused" this fails, which is the point.
    expect(PAGE).toContain('apiGetOrder');
    expect(PAGE).toMatch(/reachedIndex[\s\S]{0,200}order\.status/);
  });
});

describe('what it says at each point', () => {
  it('covers the four states an order really moves through', () => {
    for (const status of ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED']) {
      expect(PAGE).toContain(`status: '${status}'`);
    }
  });

  it('does not promise delivery on a cancelled or refunded order', () => {
    /*
     * The worst version of the old copy: telling somebody their refunded order
     * is "being prepared for shipment". Both terminal states are handled before
     * the progress list is reached.
     */
    expect(PAGE).toContain("order.status === 'CANCELLED'");
    expect(PAGE).toContain("order.status === 'REFUNDED'");
  });

  it('says so when the order itself could not be found', () => {
    // A wrong id, or somebody else's order. Implying a parcel exists is worse
    // than an empty page.
    expect(PAGE).toMatch(/if\s*\(!order\)/);
  });
});

describe('the state is not carried by colour alone', () => {
  it('marks the current step with aria-current', () => {
    // The page exists to answer "where is my order". A screen reader has to be
    // able to answer it without the visual treatment.
    expect(PAGE).toContain("aria-current={current ? 'step' : undefined}");
  });

  it('names the list for assistive technology', () => {
    expect(PAGE).toContain('aria-label="Order progress"');
  });

  it('fills the reached dot rather than only tinting it', () => {
    /*
     * A shape change, so it survives a greyscale display and any colour-vision
     * difference. Asserted in the CSS because that is where it would be lost —
     * a later "simplify the palette" pass that dropped the background would
     * leave two greys and no other difference.
     */
    expect(CSS).toMatch(
      /\.mr-track-step\[data-reached='true'\] \.mr-track-step-dot \{[^}]*background:/,
    );
  });

  it('ships the classes the page asks for', () => {
    // A structural test that passed while the page rendered unstyled would be
    // worse than none.
    for (const cls of [
      'mr-track-empty',
      'mr-track-steps',
      'mr-track-step',
      'mr-track-step-dot',
      'mr-track-step-label',
      'mr-track-step-note',
    ]) {
      expect(CSS).toContain(`.${cls}`);
      expect(PAGE).toContain(cls);
    }
  });
});
