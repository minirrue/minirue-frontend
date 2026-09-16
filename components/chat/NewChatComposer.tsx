'use client';

import React from 'react';
import { catalog, mediaImageUrl, productBrand, type ApiProduct } from '@/lib/api/catalog';
import type { SupportSubject } from '@/lib/support/support-context';
import RemoteImage from '@/components/ui/RemoteImage';
import Button from '@/components/ui/Button';
import { apiListOrders, type OrderSummary } from '@/lib/checkout/checkout-api';
import { formatOrderRef, formatOrderStatus } from '@/lib/orders/order-format';
import { groupOrderLines } from '@/lib/orders/order-lines';

/**
 * Starting a conversation: which product it is about, and the first message.
 *
 * There used to be a "Who would you like to talk to?" select above this. It is
 * gone, and it was never doing what it appeared to: for a question about a
 * product the server derives the owner from the product itself and DISCARDS
 * whatever the shopper picked, so the field only ever affected general
 * questions — and a guest could never reach this form at all.
 *
 * Asking a shopper to choose a department is asking them to know the business.
 * The product is the thing they actually know, and the product decides who
 * answers.
 */
export interface NewChatDraft {
  /** Always null now: routing is derived server-side from the product. */
  collaboratorId: string | null;
  subject: SupportSubject | null;
  body: string;
}

interface Props {
  /** Prefilled when the widget is opened from a product page. */
  pageSubject: SupportSubject | null;
  onSubmit: (draft: NewChatDraft) => void;
  onCancel: () => void;
  submitting?: boolean;
}

const TRACE = 'PG-STOREFRONT-SUP-001';

function productSubject(product: ApiProduct): SupportSubject {
  return {
    productId: product.id,
    subjectSnapshot: { name: product.name, slug: product.slug },
  };
}

function orderSubject(order: OrderSummary): SupportSubject {
  return {
    orderId: order.id,
    // These fields make the selected order legible immediately. The API owns
    // authorization and replaces order facts with its own trusted snapshot.
    subjectSnapshot: {
      orderNumber: order.orderNumber,
      orderSeq: order.orderSeq,
      status: order.status,
      items: groupOrderLines(order.items).map((line) => line.name),
      createdAt: order.createdAt,
    },
  };
}

/**
 * `--mr-line` DID NOT EXIST (#44).
 *
 * It is used nowhere else in this repo and is defined nowhere in
 * `mr-tokens.css`. `border: 1px solid var(--mr-line)` with no fallback is
 * invalid at computed-value time, so the whole shorthand unsets and the
 * border-style falls back to `none` — these fields and buttons rendered with
 * NO BORDER AT ALL. Exactly the `.mr-btn` class bug from #9, one file over:
 * the call site reads as styled and paints nothing, which is most of "no
 * pointing on what is element as a button". `--mr-hairline` is the real
 * token and is what every other chat surface already uses.
 */
const fieldStyle: React.CSSProperties = {
  font: 'inherit',
  // 16px stops iOS zooming the whole page when the field takes focus.
  fontSize: 16,
  padding: '11px 12px',
  borderRadius: 'var(--mr-radius-md)',
  border: '1px solid var(--mr-hairline)',
  background: 'var(--mr-bg-raised)',
  color: 'var(--mr-fg)',
  width: '100%',
  minWidth: 0,
};

/**
 * A product search result is a ROW, not a pill.
 *
 * Deliberately NOT routed through the shared `Button` (#44): a 56px-tall
 * record with a thumbnail, a name, a brand and a SKU is not a call to action,
 * and wrapping it in an uppercase letter-spaced pill would make the picker
 * look worse, not more on-theme. So it gets a *stated* affordance instead of
 * an inherited one — a hairline border and a hover fill, both below, plus the
 * global `:focus-visible` gold ring from globals.css, pulled inside the row
 * with `outlineOffset: -2` so it is not clipped by the scroll container.
 */
const resultRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  width: '100%',
  // The thumbnail sets the target height, well past the 44px tap floor.
  minHeight: 56,
  padding: '8px 10px',
  // Resting border, not a transparent one: a row with nothing drawn round it
  // is indistinguishable from the search results text above it.
  border: '1px solid var(--mr-hairline)',
  borderRadius: 'var(--mr-radius-md)',
  background: 'var(--mr-bg-raised)',
  textAlign: 'left',
  cursor: 'pointer',
  font: 'inherit',
  color: 'inherit',
  outlineOffset: -2,
  transition: 'background var(--mr-dur-fast) var(--mr-ease-out), border-color var(--mr-dur-fast) var(--mr-ease-out)',
};

export default function NewChatComposer({
  pageSubject,
  onSubmit,
  onCancel,
  submitting,
}: Props) {
  const [body, setBody] = React.useState('');
  const [subject, setSubject] = React.useState<SupportSubject | null>(pageSubject);
  const [picked, setPicked] = React.useState<ApiProduct | null>(null);
  const [pickedOrder, setPickedOrder] = React.useState<OrderSummary | null>(null);
  /** Set by "Just a general question": the shopper has said no product applies. */
  const [general, setGeneral] = React.useState(false);
  const [orderPickerOpen, setOrderPickerOpen] = React.useState(false);
  const [orders, setOrders] = React.useState<OrderSummary[]>([]);
  const [ordersLoading, setOrdersLoading] = React.useState(false);
  const [ordersError, setOrdersError] = React.useState(false);

  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<ApiProduct[]>([]);
  const [searching, setSearching] = React.useState(false);
  /** Which result row the pointer is over — the row's deliberate hover
   *  affordance (#44). State rather than a `:hover` rule because this repo
   *  styles inline; `components/ui/Button.tsx` tracks its own hover the same
   *  way. Keyboard users get the global `:focus-visible` ring instead. */
  const [hoveredResultId, setHoveredResultId] = React.useState<string | null>(null);

  // Debounced so typing does not fire a request per keystroke.
  React.useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      catalog
        .search(q)
        // Five fits a chat panel; more turns this into a search page.
        .then((res) => setResults((res.data ?? []).slice(0, 5)))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const chosen = subject !== null || general;
  const canSend = !!body.trim() && chosen && !submitting;

  function pick(product: ApiProduct) {
    setPicked(product);
    setPickedOrder(null);
    setSubject(productSubject(product));
    setGeneral(false);
    setOrderPickerOpen(false);
    setQuery('');
    setResults([]);
  }

  async function openOrderPicker() {
    setOrderPickerOpen(true);
    setOrdersLoading(true);
    setOrdersError(false);
    try {
      const response = await apiListOrders(1, 20);
      setOrders(response.data);
    } catch {
      setOrders([]);
      setOrdersError(true);
    } finally {
      setOrdersLoading(false);
    }
  }

  function pickOrder(order: OrderSummary) {
    setPicked(null);
    setPickedOrder(order);
    setSubject(orderSubject(order));
    setGeneral(false);
    setOrderPickerOpen(false);
  }

  return (
    <form data-lenis-prevent
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSend) return;
        onSubmit({
          // Never sent: an ITEM thread is routed by the product's own owner,
          // and a general question goes to MiniRue.
          collaboratorId: null,
          subject,
          body: body.trim(),
        });
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        padding: 14,
        overflowY: 'auto',
        minHeight: 0,
      }}
      data-trace-id={`${TRACE}::EL-FORM-new-chat`}
    >
      {!chosen && orderPickerOpen ? (
        <section aria-labelledby="mr-support-order-heading" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h3 id="mr-support-order-heading" style={{ margin: 0, fontFamily: 'Inter Tight, sans-serif', fontSize: 14, fontWeight: 600, color: 'var(--mr-ink-900)' }}>
                Choose an order
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: 12, lineHeight: 1.45, color: 'var(--mr-ink-400)' }}>
                We&apos;ll attach it so the team can help faster.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOrderPickerOpen(false)}
              style={{ minHeight: 44, flexShrink: 0 }}
              traceId={`${TRACE}::EL-BTN-back-from-orders`}
            >
              Back
            </Button>
          </div>

          {ordersLoading ? (
            <p role="status" style={{ margin: 0, padding: '18px 2px', fontSize: 13, color: 'var(--mr-ink-400)' }}>
              Loading your orders…
            </p>
          ) : ordersError ? (
            <div role="alert" style={{ padding: 12, border: '1px solid var(--mr-hairline)', borderRadius: 'var(--mr-radius-md)', background: 'var(--mr-cream-200)' }}>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45, color: 'var(--mr-ink-700)' }}>
                We couldn&apos;t load your orders. Your message is still safe.
              </p>
              <Button variant="outline" size="sm" onClick={() => void openOrderPicker()} style={{ minHeight: 44, marginTop: 10 }}>
                Try again
              </Button>
            </div>
          ) : orders.length === 0 ? (
            <div style={{ padding: 12, border: '1px solid var(--mr-hairline)', borderRadius: 'var(--mr-radius-md)', background: 'var(--mr-cream-200)' }}>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45, color: 'var(--mr-ink-700)' }}>
                No orders yet. You can still ask us a general question.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setGeneral(true);
                  setOrderPickerOpen(false);
                }}
                style={{ minHeight: 44, marginTop: 10 }}
              >
                General question
              </Button>
            </div>
          ) : (
            <div data-lenis-prevent style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 250, overflowY: 'auto', paddingRight: 2 }}>
              {orders.map((order) => {
                const lines = groupOrderLines(order.items);
                const itemLabel = lines.length > 0
                  ? `${lines[0].name}${lines.length > 1 ? ` + ${lines.length - 1} more` : ''}`
                  : 'Order items';
                return (
                  <button
                    key={order.id}
                    type="button"
                    aria-label={`Order ${formatOrderRef(order)}, ${formatOrderStatus(order.status)}, ${itemLabel}`}
                    onClick={() => pickOrder(order)}
                    style={{
                      ...resultRowStyle,
                      minHeight: 68,
                      padding: '10px 12px',
                      flexDirection: 'column',
                      alignItems: 'stretch',
                      gap: 5,
                    }}
                    data-trace-id={`${TRACE}::EL-BTN-pick-order@${order.id}`}
                  >
                    <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                      <strong style={{ fontSize: 14, color: 'var(--mr-ink-900)' }}>{formatOrderRef(order)}</strong>
                      <span style={{ flexShrink: 0, border: '1px solid var(--mr-hairline)', borderRadius: 'var(--mr-radius-pill)', padding: '3px 8px', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mr-gold-700)', background: 'var(--mr-cream-100)' }}>
                        {formatOrderStatus(order.status)}
                      </span>
                    </span>
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--mr-ink-400)' }}>
                      {itemLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      ) : !chosen ? (
        <>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, color: 'var(--mr-fg-2)' }}>
              What is it about?
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Product name or code…"
              autoFocus
              style={fieldStyle}
              data-trace-id={`${TRACE}::EL-FIELD-new-chat-product`}
            />
          </label>

          {searching && query.trim() && (
            <span style={{ fontSize: 13, color: 'var(--mr-fg-3)' }}>Searching…</span>
          )}

          {!searching && query.trim() && results.length === 0 && (
            <span style={{ fontSize: 13, color: 'var(--mr-fg-3)' }}>
              Nothing matched. Try another word or paste the item code from the
              product page, or ask a general question below.
            </span>
          )}

          {results.length > 0 && (
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
              data-trace-id={`${TRACE}::EL-LIST-new-chat-products`}
            >
              {results.map((p) => {
                const image = p.media?.[0]
                  ? mediaImageUrl(p.media[0], { w: 112, h: 112 })
                  : null;
                const brand = productBrand(p);
                /**
                 * The code of the variant that MATCHED, when the shopper
                 * pasted one; otherwise the first, as a label for the product.
                 *
                 * Shown because the whole point of pasting a code is being
                 * exact — and a picker that swallows the code and offers three
                 * similar-looking bottles has given the exactness straight
                 * back. Seeing their own string echoed on a row is how the
                 * customer knows it is the right one.
                 */
                const typed = query.trim().toUpperCase();
                const variants = p.variants ?? [];
                const matchedSku =
                  variants.find((v) => v.sku?.toUpperCase().includes(typed))?.sku ??
                  variants[0]?.sku ??
                  null;
                return (
                  <button
                    key={p.id}
                    type="button"
                    style={
                      hoveredResultId === p.id
                        ? {
                            ...resultRowStyle,
                            background: 'var(--mr-cream-200)',
                            borderColor: 'var(--mr-gold-400)',
                          }
                        : resultRowStyle
                    }
                    onMouseEnter={() => setHoveredResultId(p.id)}
                    onMouseLeave={() => setHoveredResultId(null)}
                    onClick={() => pick(p)}
                    data-trace-id={`${TRACE}::EL-BTN-pick-product@${p.id}`}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: 56,
                        height: 56,
                        flexShrink: 0,
                        borderRadius: 8,
                        overflow: 'hidden',
                        background: 'var(--mr-bg-sunken)',
                      }}
                    >
                      {image ? (
                        // Optimized (#11). The row draws a 56px square and
                        // `mediaImageUrl` already asks imgproxy for the 2x
                        // render (112), so the two numbers stay in step.
                        <RemoteImage
                          src={image}
                          alt=""
                          width={56}
                          height={56}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            display: 'block',
                          }}
                        />
                      ) : null}
                    </span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: 'block', fontSize: 14 }}>{p.name}</span>
                      {brand && (
                        <span
                          style={{ display: 'block', fontSize: 12, color: 'var(--mr-fg-3)' }}
                        >
                          {brand}
                        </span>
                      )}
                      {matchedSku && (
                        <span
                          style={{
                            display: 'block',
                            fontFamily: 'var(--mr-font-mono, ui-monospace, monospace)',
                            fontSize: 11,
                            letterSpacing: '0.04em',
                            color: 'var(--mr-fg-4)',
                            marginTop: 2,
                            // Long composite SKUs must not widen the row and
                            // push the panel sideways.
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {matchedSku}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* The escape hatch. Someone whose question is not about a product
              should not have to search for one to get past this step.

              The house button, `outline` — the sign-out precedent (#44). It
              used to be a hand-rolled box whose only border was
              `var(--mr-line)`, an undefined token, so it painted as bare text
              on cream. `size="sm"` matches AccountLayoutClient's sign out
              exactly ("buttons must be same as signout button theme"). */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void openOrderPicker()}
              style={{ minHeight: 44, flex: '1 1 132px' }}
              traceId={`${TRACE}::EL-BTN-order-support`}
            >
              Order support
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setGeneral(true)}
              style={{ minHeight: 44, flex: '1 1 132px' }}
              traceId={`${TRACE}::EL-BTN-general-question`}
            >
              Just a general question
            </Button>
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ minWidth: 0, flex: 1, fontSize: 14 }}>
            {pickedOrder ? (
              <>
                Order <strong>{formatOrderRef(pickedOrder)}</strong>
                <span style={{ color: 'var(--mr-fg-3)' }}> · {formatOrderStatus(pickedOrder.status)}</span>
              </>
            ) : picked ? (
              <>
                About <strong>{picked.name}</strong>
                {productBrand(picked) && (
                  <span style={{ color: 'var(--mr-fg-3)' }}> · {productBrand(picked)}</span>
                )}
              </>
            ) : subject ? (
              <>
                About{' '}
                <strong>
                  {/* subjectSnapshot is an untyped record — it comes back from
                      the API as-is — so the name is narrowed rather than
                      assumed. */}
                  {typeof subject.subjectSnapshot?.name === 'string'
                    ? subject.subjectSnapshot.name
                    : 'this product'}
                </strong>
              </>
            ) : (
              'A general question'
            )}
          </span>
          {/* Secondary action → `outline`, same as sign out (#44). It was a
              borderless, background-less span of grey text sitting beside
              body copy: the literal complaint the sign-out button's own
              comment records ("indistinguishable from body text"). */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setPicked(null);
              setPickedOrder(null);
              setSubject(null);
              setGeneral(false);
              setOrderPickerOpen(false);
            }}
            style={{ minHeight: 44, flexShrink: 0 }}
            traceId={`${TRACE}::EL-BTN-change-subject`}
          >
            Change
          </Button>
        </div>
      )}

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 13, color: 'var(--mr-fg-2)' }}>Your message</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder="How can we help?"
          style={{ ...fieldStyle, resize: 'vertical' }}
          data-trace-id={`${TRACE}::EL-FIELD-new-chat-body`}
        />
      </label>

      {/*
        The one action this form wants, and the way out — `primary` and
        `outline`, the same pair `SignInToChat` uses (#44).

        They WRAP rather than shrink, for the reason that file documents: the
        panel is `min(360px, 100vw - 48px)` wide, so two pills forced onto one
        row on a narrow phone would squeeze both below a comfortable target.
      */}
      <div style={{ display: 'flex', gap: 'var(--mr-sp-3)', flexWrap: 'wrap' }}>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={!canSend}
          // `sm` padding already lands at 45, but the floor is stated
          // explicitly so a change to the shared padding cannot quietly drop
          // this control under 44 — same reasoning as SignInToChat.
          style={{ minHeight: 44, flex: '1 1 auto' }}
          traceId={`${TRACE}::EL-BTN-start-conversation`}
        >
          {submitting ? 'Sending…' : 'Start conversation'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          style={{ minHeight: 44 }}
          traceId={`${TRACE}::EL-BTN-cancel-new-chat`}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
