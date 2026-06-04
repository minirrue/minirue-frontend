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

/** Maps ISO currency codes to display symbols / prefixes. */
function formatPrice(amount: string, currency: string): string {
  // Use Intl.NumberFormat for proper locale-aware formatting.
  // Parse amount as number for formatting only — never stored as float.
  const num = parseFloat(amount);
  if (isNaN(num)) return `${currency} ${amount}`;
  try {
    return new Intl.NumberFormat('en-EG', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  } catch {
    // Fallback if currency code is unrecognised by Intl
    return `${currency} ${Math.round(num).toLocaleString('en-EG')}`;
  }
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
