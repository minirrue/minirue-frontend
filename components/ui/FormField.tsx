'use client';

import React from 'react';
import Input, { InputProps } from './Input';

interface FormFieldProps extends InputProps {
  helper?: string;
}

export default function FormField({ helper, ...inputProps }: FormFieldProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Input {...inputProps} />
      {helper && !inputProps.error && (
        <span
          style={{
            fontFamily: 'Inter Tight, sans-serif',
            fontSize: 12,
            color: 'var(--mr-ink-400)',
          }}
        >
          {helper}
        </span>
      )}
    </div>
  );
}
