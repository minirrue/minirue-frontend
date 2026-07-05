'use client';

import React from 'react';
import { createPortal } from 'react-dom';

interface ToastProps {
  message: string;
  onDismiss: () => void;
  durationMs?: number;
}

export default function Toast({ message, onDismiss, durationMs = 3200 }: ToastProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    const timer = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(timer);
  }, [durationMs, onDismiss]);

  if (!mounted) return null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 'var(--mr-sp-6)',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 'var(--mr-z-toast, 80)',
        maxWidth: 'min(420px, calc(100vw - 2 * var(--mr-gutter)))',
        padding: 'var(--mr-sp-3) var(--mr-sp-5)',
        background: 'var(--mr-ink-900)',
        color: 'var(--mr-cream-100)',
        borderRadius: 'var(--mr-radius-md)',
        boxShadow: 'var(--mr-shadow-lg)',
        fontFamily: 'var(--mr-font-ui)',
        fontSize: 'var(--mr-text-sm)',
        lineHeight: 1.45,
        textAlign: 'center',
        animation: 'mr-fade-up var(--mr-dur-med) var(--mr-ease-out) both',
      }}
    >
      {message}
    </div>,
    document.body,
  );
}
