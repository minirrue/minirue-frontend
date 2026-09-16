'use client';

import React from 'react';
import { GOVERNORATES, type GovernorateKey } from '@/lib/checkout/governorates';

export interface GovernorateKeySelectProps {
  value: GovernorateKey | '';
  onChange: (next: GovernorateKey) => void;
  id?: string;
  label?: string;
  error?: string;
  required?: boolean;
}

export default function GovernorateKeySelect({ value, onChange, id = 'governorate', label = 'Governorate', error, required = true }: GovernorateKeySelectProps) {
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(() => Math.max(0, GOVERNORATES.findIndex((item) => item.key === value)));
  const [focused, setFocused] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const selected = GOVERNORATES.find((item) => item.key === value);
  const listboxId = `${id}-listbox`;
  const errorId = error ? `${id}-error` : undefined;

  React.useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  function choose(index: number) {
    const option = GOVERNORATES[index];
    if (!option) return;
    onChange(option.key);
    setActiveIndex(index);
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      if (!open) {
        setOpen(true);
        setActiveIndex(Math.max(0, GOVERNORATES.findIndex((item) => item.key === value)));
      } else {
        setActiveIndex((current) => Math.min(GOVERNORATES.length - 1, Math.max(0, current + direction)));
      }
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(event.key === 'Home' ? 0 : GOVERNORATES.length - 1);
    } else if ((event.key === 'Enter' || event.key === ' ') && open) {
      event.preventDefault();
      choose(activeIndex);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setOpen(true);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <label id={`${id}-label`} htmlFor={id} style={{ fontFamily: 'var(--mr-font-label)', fontSize: 'var(--mr-text-xs)', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--mr-fg-3)' }}>
        {label}
      </label>
      <div style={{ position: 'relative', minWidth: 0 }}>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-labelledby={`${id}-label ${id}`}
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={open ? `${id}-option-${activeIndex}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          aria-required={required}
          data-value={value}
          onClick={() => setOpen((current) => !current)}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ width: '100%', minHeight: 46, padding: '12px 42px 12px 14px', borderRadius: 8, border: `1px solid ${error ? 'var(--mr-danger, #c0392b)' : focused || open ? 'var(--mr-fg)' : 'color-mix(in srgb, var(--mr-fg) 45%, transparent)'}`, boxShadow: focused || open ? '0 0 0 3px color-mix(in srgb, var(--mr-fg) 12%, transparent)' : 'none', background: 'var(--mr-bg-raised, #fff)', color: selected ? 'var(--mr-fg)' : 'var(--mr-fg-3)', fontFamily: 'var(--mr-font-ui)', fontSize: 16, lineHeight: 1.3, textAlign: 'left', cursor: 'pointer', outline: 'none', transition: 'border-color 140ms ease, box-shadow 140ms ease' }}
        >
          {selected?.en ?? 'Select governorate'}
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ position: 'absolute', right: 14, top: 15, transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 140ms ease' }}>
            <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {open && (
          <div id={listboxId} role="listbox" aria-labelledby={`${id}-label`} style={{ position: 'absolute', zIndex: 40, inset: 'calc(100% + 6px) 0 auto', maxHeight: 260, overflowY: 'auto', padding: 6, border: '1px solid var(--mr-border)', borderRadius: 10, background: 'var(--mr-bg-raised, #fff)', boxShadow: '0 16px 40px color-mix(in srgb, var(--mr-fg) 16%, transparent)' }}>
            {GOVERNORATES.map((item, index) => {
              const isSelected = item.key === value;
              const isActive = index === activeIndex;
              return (
                <div id={`${id}-option-${index}`} key={item.key} role="option" aria-selected={isSelected} onPointerMove={() => setActiveIndex(index)} onPointerDown={(event) => event.preventDefault()} onClick={() => choose(index)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 42, padding: '9px 10px', borderRadius: 6, background: isActive ? 'var(--mr-cream-200)' : 'transparent', color: 'var(--mr-fg)', fontFamily: 'var(--mr-font-ui)', fontSize: 15, fontWeight: isSelected ? 600 : 400, cursor: 'pointer' }}>
                  <span>{item.en}</span>
                  {isSelected && <span aria-hidden="true">✓</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
      {error && <span id={errorId} role="alert" style={{ fontFamily: 'var(--mr-font-ui)', fontSize: 'var(--mr-text-xs)', color: 'var(--mr-danger, #c0392b)' }}>{error}</span>}
    </div>
  );
}
