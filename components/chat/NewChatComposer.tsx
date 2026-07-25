'use client';

import React from 'react';
import { apiListPublicBrands, type PublicCollaboratorBrand } from '@/lib/api/collaborators';
import { catalog, type ApiProduct } from '@/lib/api/catalog';
import type { SupportSubject } from '@/lib/support/support-context';

/**
 * Starting a conversation: who it is for, optionally which product, and the first
 * message.
 *
 * Before this the widget guessed — general questions all went to MiniRue and the
 * only way to reach a brand was to open a chat from one of their product pages.
 * A shopper who wanted to ask a partner something had no route to them.
 */
export interface NewChatDraft {
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

function productSubject(product: ApiProduct): SupportSubject {
  return {
    productId: product.id,
    subjectSnapshot: { name: product.name, slug: product.slug },
  };
}

export default function NewChatComposer({
  pageSubject,
  onSubmit,
  onCancel,
  submitting,
}: Props) {
  const [brands, setBrands] = React.useState<PublicCollaboratorBrand[]>([]);
  const [collaboratorId, setCollaboratorId] = React.useState('');
  const [body, setBody] = React.useState('');
  const [subject, setSubject] = React.useState<SupportSubject | null>(pageSubject);

  // Product search, only opened if the shopper wants to attach one.
  const [productQuery, setProductQuery] = React.useState('');
  const [results, setResults] = React.useState<ApiProduct[]>([]);
  const [searching, setSearching] = React.useState(false);

  React.useEffect(() => {
    // Only storefront-visible active brands come back, which is exactly the set
    // the API will accept — anything else is refused as "not available for
    // support", so offering it would be a trap.
    apiListPublicBrands()
      .then(setBrands)
      .catch(() => setBrands([]));
  }, []);

  // Debounced so typing does not fire a request per keystroke.
  React.useEffect(() => {
    const q = productQuery.trim();
    if (!q) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      catalog
        .search(q)
        // Five is enough to pick from inside a chat panel; more turns the
        // composer into a search page.
        .then((res) => setResults((res.data ?? []).slice(0, 5)))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(t);
  }, [productQuery]);

  const canSend = !!body.trim() && !submitting;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSend) return;
        onSubmit({
          collaboratorId: collaboratorId || null,
          subject,
          body: body.trim(),
        });
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 14,
        overflowY: 'auto',
        minHeight: 0,
      }}
    >
      <label style={labelStyle}>
        <span style={labelTextStyle}>Who would you like to talk to?</span>
        <select
          value={collaboratorId}
          onChange={(e) => setCollaboratorId(e.target.value)}
          style={controlStyle}
          data-trace-id="PG-STOREFRONT-SUP-001::EL-FIELD-new-chat-brand"
        >
          <option value="">MiniRue</option>
          {brands.map((b) => (
            <option key={b.collaboratorId} value={b.collaboratorId}>
              {b.brandName}
            </option>
          ))}
        </select>
      </label>

      <div style={labelStyle}>
        <span style={labelTextStyle}>About a product? (optional)</span>
        {subject ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              border: '1px solid var(--mr-hairline)',
              borderRadius: 8,
              background: 'var(--mr-cream-200)',
              fontSize: 12,
              color: 'var(--mr-ink-900)',
              fontFamily: 'Inter Tight, sans-serif',
            }}
          >
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {String(subject.subjectSnapshot?.['name'] ?? 'Selected product')}
            </span>
            <button
              type="button"
              onClick={() => {
                setSubject(null);
                setProductQuery('');
              }}
              style={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: 11,
                color: 'var(--mr-ink-400)',
              }}
            >
              Remove
            </button>
          </div>
        ) : (
          <>
            <input
              type="search"
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
              placeholder="Search for a product…"
              style={controlStyle}
              data-trace-id="PG-STOREFRONT-SUP-001::EL-FIELD-new-chat-product"
            />
            {productQuery.trim() && (
              <div
                style={{
                  border: '1px solid var(--mr-hairline)',
                  borderRadius: 8,
                  marginTop: 6,
                  maxHeight: 132,
                  overflowY: 'auto',
                }}
              >
                {searching && results.length === 0 ? (
                  <p style={hintStyle}>Searching…</p>
                ) : results.length === 0 ? (
                  <p style={hintStyle}>No product matches that.</p>
                ) : (
                  results.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSubject(productSubject(p));
                        setProductQuery('');
                        setResults([]);
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px 10px',
                        border: 'none',
                        borderBottom: '1px solid var(--mr-hairline)',
                        background: 'transparent',
                        cursor: 'pointer',
                        fontFamily: 'Inter Tight, sans-serif',
                        fontSize: 12,
                        color: 'var(--mr-ink-900)',
                      }}
                    >
                      {p.name}
                    </button>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>

      <label style={labelStyle}>
        <span style={labelTextStyle}>Your message</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder="How can we help?"
          style={{ ...controlStyle, resize: 'vertical', minHeight: 76 }}
          data-trace-id="PG-STOREFRONT-SUP-001::EL-FIELD-new-chat-body"
        />
      </label>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="submit"
          disabled={!canSend}
          style={{
            flex: 1,
            padding: '10px 14px',
            border: 'none',
            borderRadius: 8,
            background: 'var(--mr-ink-900)',
            color: 'var(--mr-cream-100)',
            fontFamily: 'Jost, sans-serif',
            fontSize: 11,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            cursor: canSend ? 'pointer' : 'not-allowed',
            opacity: canSend ? 1 : 0.5,
          }}
        >
          {submitting ? 'Sending…' : 'Start conversation'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '10px 14px',
            border: '1px solid var(--mr-hairline)',
            borderRadius: 8,
            background: 'transparent',
            fontFamily: 'Jost, sans-serif',
            fontSize: 11,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'var(--mr-ink-400)',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
};

const labelTextStyle: React.CSSProperties = {
  fontFamily: 'Inter Tight, sans-serif',
  fontSize: 10,
  color: 'var(--mr-ink-400)',
};

const controlStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid var(--mr-hairline)',
  borderRadius: 8,
  padding: '8px 10px',
  outline: 'none',
  fontFamily: 'Inter Tight, sans-serif',
  fontSize: 12,
  color: 'var(--mr-ink-900)',
  background: 'var(--mr-cream-200)',
  boxSizing: 'border-box',
};

const hintStyle: React.CSSProperties = {
  margin: 0,
  padding: '8px 10px',
  fontFamily: 'Inter Tight, sans-serif',
  fontSize: 11,
  color: 'var(--mr-ink-400)',
};
