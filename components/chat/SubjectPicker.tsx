'use client';

import React from 'react';
import type { SupportSubject } from '@/lib/support/support-context';

export type SubjectChoice = { type: 'GENERAL' } | { type: 'ITEM'; subject: SupportSubject };

interface SubjectPickerProps {
  pageSubject: SupportSubject | null;
  value: SubjectChoice;
  onChange: (choice: SubjectChoice) => void;
}

function subjectLabel(subject: SupportSubject | null): string {
  const name = subject?.subjectSnapshot?.['name'];
  return typeof name === 'string' && name.length > 0 ? name : 'this item';
}

export default function SubjectPicker({ pageSubject, value, onChange }: SubjectPickerProps) {
  const selectStyle: React.CSSProperties = {
    width: '100%',
    border: '1px solid var(--mr-hairline)',
    borderRadius: 8,
    padding: '8px 10px',
    outline: 'none',
    fontFamily: 'Inter Tight, sans-serif',
    fontSize: 12,
    color: 'var(--mr-ink-900)',
    background: 'var(--mr-cream-200)',
  };

  return (
    <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--mr-hairline)', background: 'var(--mr-cream-100)' }}>
      <label htmlFor="mr-support-subject" style={{ fontFamily: 'Inter Tight, sans-serif', fontSize: 10, color: 'var(--mr-ink-400)', marginBottom: 4, display: 'block' }}>
        What's this about?
      </label>
      <select
        id="mr-support-subject"
        style={selectStyle}
        value={value.type === 'ITEM' ? 'ITEM' : 'GENERAL'}
        onChange={(e) => {
          if (e.target.value === 'ITEM' && pageSubject) {
            onChange({ type: 'ITEM', subject: pageSubject });
          } else {
            onChange({ type: 'GENERAL' });
          }
        }}
      >
        {pageSubject && <option value="ITEM">{subjectLabel(pageSubject)}</option>}
        <option value="GENERAL">General question</option>
      </select>
    </div>
  );
}
