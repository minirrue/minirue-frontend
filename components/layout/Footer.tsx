'use client';

import React from 'react';
import Wordmark from '@/components/ui/Wordmark';
import PaymentBadge from '@/components/ui/PaymentBadge';
import SocialIcon from '@/components/ui/SocialIcon';
import { useBreakpoint } from '@/lib/hooks/useBreakpoint';
import type { FooterConfig } from '@/lib/api/storefront';

export default function Footer({ config }: { config: FooterConfig }) {
  const { mobile } = useBreakpoint();
  const ref = React.useRef<HTMLElement | null>(null);

  React.useLayoutEffect(() => {
    const measure = () => {
      const el = ref.current;
      if (!el) return;
      document.body.style.paddingBottom = el.offsetHeight + 'px';
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (ref.current) ro.observe(ref.current);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
      document.body.style.paddingBottom = '';
    };
  }, []);

  return (
    <footer
      ref={ref}
      data-mr-surface="ink"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 0,
        background: 'var(--mr-ink-900)',
        color: 'var(--mr-cream-100)',
        padding: mobile ? '48px 24px 28px' : '72px 48px 44px',
      }}
    >
      <div style={{ maxWidth: 1280, margin: '0 auto', textAlign: 'center' }}>
        <Wordmark
          size={mobile ? 26 : 38}
          color="var(--mr-cream-100)"
          captionColor="var(--mr-ink-400)"
        />
        {config.newsletterEnabled && (
          <div style={{ marginTop: 44, maxWidth: 460, margin: '44px auto 0' }}>
            <div
              style={{
                fontFamily: 'Jost, sans-serif',
                fontSize: 10,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                marginBottom: 16,
                color: 'var(--mr-gold-300)',
              }}
            >
              {config.newsletterEyebrow}
            </div>
            <p
              style={{
                fontFamily: 'Cormorant Garamond, serif',
                fontStyle: 'italic',
                fontSize: 20,
                lineHeight: 1.4,
                color: 'var(--mr-cream-200)',
                margin: '0 0 24px',
              }}
            >
              {config.newsletterBlurb}
              {config.tagline ? ` ${config.tagline}` : ''}
            </p>
            <form
              className="mr-underline-input"
              style={{
                display: 'flex',
                paddingBottom: 8,
                gap: 12,
                alignItems: 'center',
                borderBottom: '1px solid rgba(238,230,209,.2)',
              }}
              onSubmit={(e) => e.preventDefault()}
            >
              <input
                placeholder="you@address.com"
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 0,
                  color: 'var(--mr-cream-100)',
                  fontFamily: 'Inter Tight, sans-serif',
                  fontSize: 14,
                  padding: '8px 0',
                  outline: 'none',
                }}
              />
              <button
                style={{
                  background: 'none',
                  border: 0,
                  color: 'var(--mr-gold-300)',
                  cursor: 'pointer',
                  fontFamily: 'Jost, sans-serif',
                  fontSize: 10,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  transition: 'color 200ms var(--mr-ease-out)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--mr-gold-500)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--mr-gold-300)')}
              >
                Subscribe <span className="mr-link-arrow">→</span>
              </button>
            </form>
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: mobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)',
            gap: mobile ? 28 : 44,
            marginTop: 60,
            textAlign: 'left',
          }}
        >
          {config.columns.map((c) => (
            <div key={c.id}>
              <div
                style={{
                  fontFamily: 'Jost, sans-serif',
                  fontSize: 9,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--mr-gold-300)',
                  marginBottom: 16,
                }}
              >
                {c.title}
              </div>
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                {c.links.map((link) => (
                  <li key={link.id}>
                    <a
                      href={link.href}
                      className="mr-nav-link"
                      style={{
                        fontFamily: 'Inter Tight, sans-serif',
                        fontSize: 13,
                        color: 'var(--mr-cream-200)',
                        opacity: 0.75,
                        textDecoration: 'none',
                      }}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 44,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', gap: 14 }}>
            {config.socials.map((s) => (
              <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--mr-cream-200)', opacity: 0.75 }}>
                <SocialIcon network={s.network} />
              </a>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {config.paymentBadges.map((b) => (
              <PaymentBadge key={b} badge={b} />
            ))}
          </div>
        </div>

        <div
          style={{
            marginTop: 56,
            paddingTop: 28,
            borderTop: '1px solid rgba(238,230,209,.1)',
            display: 'flex',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
            fontFamily: 'Inter Tight, sans-serif',
            fontSize: 11,
            color: 'var(--mr-ink-400)',
          }}
        >
          {/*
            The spaced "Mini Rue" is deliberate and load-bearing, not a typo. Google's own guidance
            is "make sure your site includes the words people would type." Users search "mini rue
            shop" / "mini rue store", but the spaced form previously appeared NOWHERE in visible
            copy — only in <title> and JSON-LD. Structured data alone does not fully substitute for
            the words existing as readable text on the page. One natural mention in the footer, on
            every page, is the honest way to close that gap. The line now lives in the database
            (FooterConfig.legalLine) — keep this comment so nobody "fixes" the spelling away.
          */}
          <span>{config.legalLine}</span>
          <span>{config.secondaryLine}</span>
        </div>
      </div>
    </footer>
  );
}
