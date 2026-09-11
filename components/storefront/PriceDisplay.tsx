import { formatMoney } from '@/lib/format/money';

/**
 * PriceDisplay — formats price_amount + currency code to a display string.
 * price_amount is ALWAYS a string (Dinero.js) and is never parsed as float for display.
 */

interface PriceDisplayProps {
  amount: string;
  currency: string;
  wasAmount?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Maps ISO currency codes to display symbols / prefixes.
 * Exported so any other place that needs to print a price (e.g. a button
 * label that isn't a <PriceDisplay>) uses the same `Intl.NumberFormat`
 * options instead of a second, drifting copy.
 */
export function formatPrice(amount: string, currency: string): string {
  return formatMoney(amount, currency);
}

export default function PriceDisplay({
  amount,
  currency,
  wasAmount,
  className,
  style,
}: PriceDisplayProps) {
  return (
    <span
      className={className}
      style={{
        fontFamily: 'var(--mr-font-serif)',
        fontWeight: 500,
        fontSize: 'var(--mr-text-md)',
        color: 'var(--mr-fg)',
        fontVariantNumeric: 'oldstyle-nums tabular-nums',
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 'var(--mr-sp-2)',
        ...style,
      }}
    >
      {wasAmount && (
        <span
          style={{
            color: 'var(--mr-fg-4)',
            textDecoration: 'line-through',
            fontSize: 'var(--mr-text-base)',
          }}
        >
          {formatPrice(wasAmount, currency)}
        </span>
      )}
      {formatPrice(amount, currency)}
    </span>
  );
}
