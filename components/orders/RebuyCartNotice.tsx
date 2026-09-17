'use client';

import React from 'react';
import { consumeRebuyResult, type RebuyResult } from '@/lib/orders/rebuy';

export default function RebuyCartNotice() {
  const [result, setResult] = React.useState<RebuyResult | null>(null);
  const consumed = React.useRef(false);

  React.useEffect(() => {
    // React Strict Mode intentionally replays effects in development. Consume
    // this one-shot handoff once, or the replay immediately replaces the real
    // result with null and the notice disappears before the shopper sees it.
    if (consumed.current) return;
    consumed.current = true;
    setResult(consumeRebuyResult());
  }, []);

  if (!result) return null;

  const unavailable = result.issues.filter((issue) => issue.kind === 'unavailable');
  const adjusted = result.issues.filter((issue) => issue.kind === 'quantity-adjusted');
  const complete = result.addedLines > 0 && result.issues.length === 0;

  return (
    <section
      role="status"
      aria-live="polite"
      style={{
        marginBottom: 'var(--mr-sp-5)',
        padding: 'var(--mr-sp-4) var(--mr-sp-5)',
        borderRadius: 'var(--mr-radius-md)',
        background: complete ? 'rgba(63,107,74,0.10)' : 'rgba(184,131,42,0.12)',
        color: complete ? 'var(--mr-success)' : 'var(--mr-fg)',
      }}
    >
      <p style={{ margin: 0, fontWeight: 500 }}>
        {complete
          ? 'Your previous order is back in your bag.'
          : result.addedLines > 0
            ? 'We added everything that is available today.'
            : 'None of those items are available to add today.'}
      </p>
      {adjusted.length > 0 && (
        <ul style={{ margin: 'var(--mr-sp-2) 0 0', paddingInlineStart: 20, color: 'var(--mr-fg-2)', fontSize: 'var(--mr-text-sm)' }}>
          {adjusted.map((issue, index) => (
            <li key={`${issue.name}-adjusted-${index}`}>
              {issue.name}: added {issue.addedQty} of {issue.requestedQty} because of current stock or the bag limit.
            </li>
          ))}
        </ul>
      )}
      {unavailable.length > 0 && (
        <ul style={{ margin: 'var(--mr-sp-2) 0 0', paddingInlineStart: 20, color: 'var(--mr-fg-2)', fontSize: 'var(--mr-text-sm)' }}>
          {unavailable.map((issue, index) => (
            <li key={`${issue.name}-unavailable-${index}`}>
              {issue.name} is currently unavailable and was not added.
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
