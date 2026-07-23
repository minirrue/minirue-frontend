/**
 * Canonical RBAC role vocabulary — mirrors
 * `apps/minirue-backend/src/common/enums/role.enum.ts`.
 *
 * DEV and OWNER were retired by backend migration 0014: DEV was an environment
 * bypass rather than a real account, and OWNER was folded into ADMIN. COLLAB is
 * listed because the backend can return it, even though a brand partner has
 * nothing to do on the storefront — an unknown role string would otherwise be
 * treated as invalid and drop the session.
 */

export const Role = {
  SUPERADMIN: 'SUPERADMIN',
  ADMIN: 'ADMIN',
  STAFF: 'STAFF',
  COLLAB: 'COLLAB',
  CUSTOMER: 'CUSTOMER',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const ROLE_VALUES: readonly Role[] = Object.values(Role);

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLE_VALUES as readonly string[]).includes(value);
}

export function roleLabel(role: Role): string {
  const labels: Record<Role, string> = {
    [Role.SUPERADMIN]: 'Super Admin',
    [Role.ADMIN]: 'Admin',
    [Role.STAFF]: 'Support Staff',
    [Role.COLLAB]: 'Collab',
    [Role.CUSTOMER]: 'Customer',
  };
  return labels[role];
}
