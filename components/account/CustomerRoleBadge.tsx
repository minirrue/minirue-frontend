'use client';

import { Role, isRole, roleLabel } from '@/lib/auth/role';

export interface CustomerRoleBadgeProps {
  role?: string;
}

export default function CustomerRoleBadge({ role }: CustomerRoleBadgeProps) {
  if (!role || !isRole(role)) return null;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        fontFamily: 'var(--mr-font-label)',
        color: 'var(--mr-ink-800)',
        background: 'var(--mr-gold-100, #f5ecd6)',
        border: '1px solid var(--mr-gold-300, #e8d9b0)',
      }}
      title={roleLabel(role)}
    >
      {roleLabel(role)}
    </span>
  );
}
