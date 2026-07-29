'use client';

import React from 'react';
import { catalog, mediaImageUrl, productBrand, type ApiProduct } from '@/lib/api/catalog';
import type { SupportSubject } from '@/lib/support/support-context';

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

const fieldStyle: React.CSSProperties = {
  font: 'inherit',
  // 16px stops iOS zooming the whole page when the field takes focus.
  fontSize: 16,
  padding: '11px 12px',
  borderRadius: 10,
  border: '1px solid var(--mr-line)',
  background: 'var(--mr-bg)',
  color: 'var(--mr-fg)',
  width: '100%',
  minWidth: 0,
};

const resultRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  width: '100%',
  // The thumbnail sets the target height, well past the 44px tap floor.
  minHeight: 56,
  padding: '8px 10px',
  border: '1px solid transparent',
  borderRadius: 10,
  background: 'transparent',
  textAlign: 'left',
  cursor: 'pointer',
  font: 'inherit',
  color: 'inherit',
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
  /** Set by "Just a general question": the shopper has said no product applies. */
  const [general, setGeneral] = React.useState(false);

  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<ApiProduct[]>([]);
  const [searching, setSearching] = React.useState(false);

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
    setSubject(productSubject(product));
    setGeneral(false);
    setQuery('');
    setResults([]);
  }

  return (
    <form
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
      {!chosen ? (
        <>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, color: 'var(--mr-fg-2)' }}>
              What is it about?
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for a product…"
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
              Nothing matched. Try another word, or ask a general question below.
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
                return (
                  <button
                    key={p.id}
                    type="button"
                    style={resultRowStyle}
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
                        background: 'var(--mr-bg-2, #f4f1ec)',
                      }}
                    >
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={image}
                          alt=""
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
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* The escape hatch. Someone whose question is not about a product
              should not have to search for one to get past this step. */}
          <button
            type="button"
            onClick={() => setGeneral(true)}
            style={{
              alignSelf: 'flex-start',
              font: 'inherit',
              fontSize: 13,
              minHeight: 44,
              padding: '0 14px',
              borderRadius: 10,
              border: '1px solid var(--mr-line)',
              background: 'transparent',
              color: 'var(--mr-fg-2)',
              cursor: 'pointer',
            }}
            data-trace-id={`${TRACE}::EL-BTN-general-question`}
          >
            Just a general question
          </button>
        </>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ minWidth: 0, flex: 1, fontSize: 14 }}>
            {picked ? (
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
          <button
            type="button"
            onClick={() => {
              setPicked(null);
              setSubject(null);
              setGeneral(false);
            }}
            style={{
              font: 'inherit',
              fontSize: 13,
              minHeight: 44,
              padding: '0 10px',
              border: 0,
              background: 'none',
              color: 'var(--mr-fg-3)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
            data-trace-id={`${TRACE}::EL-BTN-change-subject`}
          >
            Change
          </button>
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

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          type="submit"
          disabled={!canSend}
          style={{
            font: 'inherit',
            fontSize: 13,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            minHeight: 48,
            padding: '0 20px',
            borderRadius: 10,
            border: 0,
            background: canSend ? 'var(--mr-fg)' : 'var(--mr-fg-4, #9a938a)',
            color: 'var(--mr-bg, #fff)',
            cursor: canSend ? 'pointer' : 'not-allowed',
            flex: '1 1 auto',
          }}
          data-trace-id={`${TRACE}::EL-BTN-start-conversation`}
        >
          {submitting ? 'Sending…' : 'Start conversation'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            font: 'inherit',
            fontSize: 13,
            minHeight: 48,
            padding: '0 16px',
            borderRadius: 10,
            border: '1px solid var(--mr-line)',
            background: 'transparent',
            color: 'var(--mr-fg-2)',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
