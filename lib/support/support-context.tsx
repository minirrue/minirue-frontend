'use client';

import React from 'react';

export interface SupportSubject {
  productId?: string;
  orderId?: string;
  subjectSnapshot?: Record<string, unknown>;
}

interface SupportContextValue {
  subject: SupportSubject | null;
  setSubject: (subject: SupportSubject | null) => void;
}

const SupportContext = React.createContext<SupportContextValue | null>(null);

export function SupportProvider({ children }: { children: React.ReactNode }) {
  const [subject, setSubject] = React.useState<SupportSubject | null>(null);

  const value = React.useMemo<SupportContextValue>(
    () => ({ subject, setSubject }),
    [subject],
  );

  return <SupportContext.Provider value={value}>{children}</SupportContext.Provider>;
}

export function useSupportContext(): SupportContextValue {
  const ctx = React.useContext(SupportContext);
  if (!ctx) {
    throw new Error('useSupportContext must be used within a SupportProvider');
  }
  return ctx;
}
