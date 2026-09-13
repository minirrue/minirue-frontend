import React from 'react';

interface Props {
  /** The stepper, eyebrow and title — the top of the left column. */
  header: React.ReactNode;
  /** The step's own content, under the header. */
  children: React.ReactNode;
  /** The right column: order summary and whatever belongs with it. */
  aside?: React.ReactNode;
  /**
   * Where the aside goes once the columns stack on a narrow screen. `after`
   * (default) puts it under the content, where the bag's summary and its
   * checkout button belong; `between` puts it under the header, for a step
   * whose total should be read before the choice below it (payment).
   */
  asideWhenStacked?: 'after' | 'between';
  asideLabel?: string;
}

/**
 * The checkout's "two screens" (frontend#80, #101, #102).
 *
 * Owner, 2026-09-13: the order summary sits to the RIGHT, level with the
 * stepper, "as if it's 2 screens" — not starting under the heading, where it
 * used to begin a screen-height down on a laptop. So the header is a grid item
 * of its own, and the aside spans both rows beside it.
 *
 * The columns are CSS (`.mr-checkout-cols` in mr-tokens.css), not
 * `useBreakpoint`: that hook reports width 0 until after hydration, so a JS
 * layout would render stacked and then jump into columns on every desktop
 * load.
 */
export default function CheckoutColumns({
  header,
  children,
  aside,
  asideWhenStacked = 'after',
  asideLabel = 'Order summary',
}: Props) {
  return (
    <div
      className={`mr-checkout-cols${aside ? ' mr-checkout-cols--aside' : ''}`}
      data-aside-stacked={aside ? asideWhenStacked : undefined}
    >
      <div className="mr-checkout-cols__header">{header}</div>
      <div className="mr-checkout-cols__body">{children}</div>
      {aside && (
        <aside className="mr-checkout-cols__aside" aria-label={asideLabel}>
          {aside}
        </aside>
      )}
    </div>
  );
}
