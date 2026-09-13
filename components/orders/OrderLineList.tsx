import Link from 'next/link';
import type { CSSProperties } from 'react';
import RemoteImage from '@/components/ui/RemoteImage';
import { formatMoney } from '@/lib/format/money';
import type { OrderItemSummary } from '@/lib/checkout/checkout-api';
import { groupOrderLines, hasSetSavings, type OrderLine } from '@/lib/orders/order-lines';

/**
 * What was bought, one line per thing the shopper chose (#116).
 *
 * A set is ONE line — its own picture, its name, how many sets, the set price —
 * never its members. That was the owner's rule for the bag (#56) and it holds
 * after checkout too. Only the order detail (`variant="card"`) lets a set open
 * to "What's in this set", and there each member is a link to its product page
 * and nothing more: no picture, no price, no quantity.
 *
 * Every amount goes through `formatMoney` (#1); see
 * __tests__/orders/order-money-guard.test.ts.
 *
 * No hooks and no state (the expander is a native `<details>`), so a Server
 * Component can render it too.
 */

type Variant =
  /** Step 4 confirmation: compact, inside the receipt card. */
  | 'receipt'
  /** Account order detail: bordered cards, sets expandable. */
  | 'card';

interface Props {
  items: OrderItemSummary[] | undefined | null;
  currency: string;
  variant: Variant;
}

const IMAGE: Record<Variant, { w: number; h: number }> = {
  receipt: { w: 56, h: 56 },
  card: { w: 64, h: 80 },
};

function Thumb({ line, variant }: { line: OrderLine; variant: Variant }) {
  const { w, h } = IMAGE[variant];
  const frame: CSSProperties = {
    width: w,
    height: h,
    objectFit: 'cover',
    borderRadius: 'var(--mr-radius-sm)',
    border: '1px solid var(--mr-hairline)',
    background: 'var(--mr-cream-200, var(--mr-bg-sunken))',
    flexShrink: 0,
  };
  return line.imageUrl ? (
    <RemoteImage src={line.imageUrl} alt="" width={w} height={h} style={frame} />
  ) : (
    <div aria-hidden style={frame} />
  );
}

function Meta({ line }: { line: OrderLine }) {
  const parts =
    line.kind === 'bundle'
      ? [`Set of ${line.members.length}`, `Qty ${line.qty}`]
      : [line.brand, `Qty ${line.qty}`];
  return (
    <p
      style={{
        margin: '2px 0 0',
        fontFamily: 'var(--mr-font-label)',
        fontSize: 'var(--mr-text-xs)',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'var(--mr-fg-3)',
      }}
    >
      {parts.filter(Boolean).join(' · ')}
    </p>
  );
}

function Members({ line }: { line: OrderLine }) {
  return (
    <details data-testid="set-members" style={{ marginTop: 8 }}>
      <summary
        style={{
          cursor: 'pointer',
          fontSize: 'var(--mr-text-xs)',
          fontFamily: 'var(--mr-font-label)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--mr-fg-2)',
        }}
      >
        What&apos;s in this set
      </summary>
      <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'grid', gap: 6 }}>
        {line.members.map((m) => (
          <li key={m.key} style={{ fontSize: 'var(--mr-text-sm)' }}>
            {m.href ? (
              <Link href={m.href} style={{ color: 'var(--mr-fg)', textDecoration: 'underline' }}>
                {m.name}
              </Link>
            ) : (
              <span style={{ color: 'var(--mr-fg-2)' }}>{m.name}</span>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

const ROW: Record<Variant, CSSProperties> = {
  receipt: { display: 'flex', gap: 'var(--mr-sp-4)', alignItems: 'center' },
  card: {
    display: 'flex',
    gap: 16,
    alignItems: 'flex-start',
    padding: 16,
    border: '1px solid var(--mr-border)',
    borderRadius: 'var(--mr-radius-md)',
    background: 'var(--mr-bg-raised)',
  },
};

const LIST: Record<Variant, CSSProperties> = {
  receipt: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--mr-sp-4)',
    textAlign: 'left',
  },
  card: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 },
};

export default function OrderLineList({ items, currency, variant }: Props) {
  const lines = groupOrderLines(items);
  if (lines.length === 0) return null;

  return (
    <ul style={LIST[variant]} data-testid="order-lines">
      {lines.map((line) => (
        <li key={line.key} data-line-kind={line.kind} style={ROW[variant]}>
          <Thumb line={line} variant={variant} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <p
              style={{
                margin: 0,
                fontFamily: variant === 'card' ? undefined : 'var(--mr-font-serif)',
                fontWeight: variant === 'card' ? 500 : undefined,
                fontSize: 'var(--mr-text-base)',
                color: 'var(--mr-fg)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {line.name}
            </p>
            <Meta line={line} />
            {variant === 'card' && line.detail && (
              <p style={{ margin: '4px 0 0', fontSize: 'var(--mr-text-xs)', color: 'var(--mr-fg-3)' }}>
                {line.detail}
              </p>
            )}
            {variant === 'card' && line.kind === 'bundle' && line.members.length > 0 && (
              <Members line={line} />
            )}
          </div>
          <p
            className="mr-num"
            style={{
              margin: 0,
              fontFamily: variant === 'card' ? undefined : 'var(--mr-font-serif)',
              fontWeight: variant === 'card' ? 500 : undefined,
              fontSize: 'var(--mr-text-base)',
              color: 'var(--mr-fg)',
              whiteSpace: 'nowrap',
            }}
          >
            {formatMoney(line.lineTotalAmount, currency)}
          </p>
        </li>
      ))}
    </ul>
  );
}

/**
 * "Set savings −EGP 120" for the totals block, or nothing.
 *
 * The saving is already inside the line prices and the total — this line
 * explains the total, it never changes it.
 */
export function SetSavingsRow({
  amount,
  currency,
  style,
}: {
  amount: string | null | undefined;
  currency: string;
  style?: CSSProperties;
}) {
  if (!hasSetSavings(amount)) return null;
  return (
    <div
      data-testid="set-savings"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 'var(--mr-sp-4)',
        fontSize: 'var(--mr-text-sm)',
        color: 'var(--mr-fg-2)',
        ...style,
      }}
    >
      <span>Set savings</span>
      <span className="mr-num">−{formatMoney(amount, currency)}</span>
    </div>
  );
}
