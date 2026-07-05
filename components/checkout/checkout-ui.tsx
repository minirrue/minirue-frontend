'use client';

import React from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';

export function CheckoutSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 'var(--mr-sp-6)' }}>
      <h2
        style={{
          fontFamily: 'var(--mr-font-label)',
          fontSize: 'var(--mr-text-xs)',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: 'var(--mr-fg)',
          margin: '0 0 var(--mr-sp-4)',
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

export function CheckoutOption({
  name,
  checked,
  disabled,
  onChange,
  title,
  description,
  badge,
}: {
  name: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  title: string;
  description?: React.ReactNode;
  badge?: string;
}) {
  return (
    <label
      style={{
        display: 'flex',
        gap: 'var(--mr-sp-4)',
        padding: 'var(--mr-sp-4) var(--mr-sp-5)',
        borderRadius: 'var(--mr-radius-md)',
        border: checked ? '1px solid var(--mr-ink-900)' : '1px solid var(--mr-hairline)',
        background: checked ? 'var(--mr-cream-100)' : 'transparent',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        transition:
          'border-color var(--mr-dur-fast) var(--mr-ease-out), background var(--mr-dur-fast) var(--mr-ease-out)',
      }}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        style={{ marginTop: 4, accentColor: 'var(--mr-ink-900)' }}
      />
      <span style={{ flex: 1 }}>
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--mr-sp-3)',
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--mr-font-ui)',
              fontSize: 'var(--mr-text-base)',
              fontWeight: 500,
              color: 'var(--mr-fg)',
            }}
          >
            {title}
          </span>
          {badge && (
            <span
              style={{
                fontFamily: 'var(--mr-font-label)',
                fontSize: 9,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--mr-gold-700)',
                border: '1px solid var(--mr-gold-300)',
                borderRadius: 'var(--mr-radius-pill)',
                padding: '3px 8px',
              }}
            >
              {badge}
            </span>
          )}
        </span>
        {description && (
          <span
            style={{
              display: 'block',
              marginTop: 'var(--mr-sp-2)',
              fontFamily: 'var(--mr-font-ui)',
              fontSize: 'var(--mr-text-sm)',
              color: 'var(--mr-fg-3)',
              lineHeight: 1.5,
            }}
          >
            {description}
          </span>
        )}
      </span>
    </label>
  );
}

export function CheckoutAlert({
  variant = 'error',
  children,
  onDismiss,
}: {
  variant?: 'error' | 'warning' | 'info';
  children: React.ReactNode;
  onDismiss?: () => void;
}) {
  const palette =
    variant === 'warning'
      ? { bg: 'rgba(184,131,42,0.12)', fg: 'var(--mr-warning)' }
      : variant === 'info'
        ? { bg: 'var(--mr-cream-300)', fg: 'var(--mr-fg-2)' }
        : { bg: 'rgba(142,20,24,0.08)', fg: 'var(--mr-danger)' };

  return (
    <div
      role="alert"
      style={{
        padding: 'var(--mr-sp-3) var(--mr-sp-4)',
        background: palette.bg,
        color: palette.fg,
        borderRadius: 'var(--mr-radius-md)',
        fontFamily: 'var(--mr-font-ui)',
        fontSize: 'var(--mr-text-sm)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 'var(--mr-sp-3)',
        marginBottom: 'var(--mr-sp-4)',
      }}
    >
      <span>{children}</span>
      {onDismiss && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 18 }}
        >
          ×
        </button>
      )}
    </div>
  );
}

export function CheckoutSummaryCard({ children }: { children: React.ReactNode }) {
  return (
    <aside
      style={{
        background: 'var(--mr-cream-100)',
        borderRadius: 'var(--mr-radius-lg)',
        padding: 'var(--mr-sp-5)',
        boxShadow: 'var(--mr-shadow-sm)',
        border: '1px solid var(--mr-hairline)',
      }}
    >
      {children}
    </aside>
  );
}

export function CheckoutActions({
  primaryLabel,
  onPrimary,
  primaryDisabled,
  primaryLoading,
  backHref,
  backLabel = 'Back',
}: {
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div style={{ marginTop: 'var(--mr-sp-6)' }}>
      <Button
        variant="primary"
        sweep
        disabled={primaryDisabled || primaryLoading}
        onClick={onPrimary}
        style={{ width: '100%' }}
      >
        {primaryLoading ? 'Please wait…' : primaryLabel}
      </Button>
      {backHref && (
        <Link
          href={backHref}
          style={{
            display: 'block',
            textAlign: 'center',
            marginTop: 'var(--mr-sp-4)',
            fontFamily: 'var(--mr-font-label)',
            fontSize: 'var(--mr-text-xs)',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--mr-fg-3)',
            textDecoration: 'none',
          }}
        >
          ← {backLabel}
        </Link>
      )}
    </div>
  );
}

export function CheckoutFileDrop({
  accept,
  onFile,
  preview,
  hint,
}: {
  accept: string;
  onFile: (file: File | null) => void;
  preview: string | null;
  hint?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          onFile(e.dataTransfer.files?.[0] ?? null);
        }}
        style={{
          width: '100%',
          padding: 'var(--mr-sp-7) var(--mr-sp-5)',
          borderRadius: 'var(--mr-radius-md)',
          border: dragOver
            ? '1px dashed var(--mr-gold-500)'
            : '1px dashed var(--mr-border)',
          background: dragOver ? 'var(--mr-cream-100)' : 'var(--mr-cream-200)',
          cursor: 'pointer',
          textAlign: 'center',
          transition: 'border-color var(--mr-dur-fast) var(--mr-ease-out), background var(--mr-dur-fast) var(--mr-ease-out)',
        }}
      >
        <span
          style={{
            display: 'block',
            fontFamily: 'var(--mr-font-label)',
            fontSize: 'var(--mr-text-xs)',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'var(--mr-ink-700)',
            marginBottom: 'var(--mr-sp-2)',
          }}
        >
          Upload receipt
        </span>
        <span
          style={{
            fontFamily: 'var(--mr-font-ui)',
            fontSize: 'var(--mr-text-sm)',
            color: 'var(--mr-fg-3)',
          }}
        >
          {hint ?? 'PNG or JPG · max 10 MB'}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt="Receipt preview"
          style={{
            marginTop: 'var(--mr-sp-4)',
            maxHeight: 220,
            width: '100%',
            objectFit: 'contain',
            borderRadius: 'var(--mr-radius-md)',
            border: '1px solid var(--mr-hairline)',
            background: 'var(--mr-cream-100)',
          }}
        />
      )}
    </div>
  );
}
