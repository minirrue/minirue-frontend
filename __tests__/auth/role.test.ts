import { describe, expect, it } from '@jest/globals';
import { Role, ROLE_VALUES, isRole } from '@/lib/auth/role';
import { parseAuthUser } from '@/lib/auth/session-role';

describe('role vocabulary', () => {
  it('matches backend canonical values', () => {
    expect(ROLE_VALUES).toContain(Role.CUSTOMER);
    expect(isRole('ADMIN')).toBe(true);
    expect(isRole('admin')).toBe(false);
  });
});

describe('parseAuthUser', () => {
  it('accepts canonical roles from /auth/me', () => {
    const user = parseAuthUser({
      userId: 'u1',
      email: 'shopper@minirue.com',
      role: Role.CUSTOMER,
    });
    expect(user.role).toBe(Role.CUSTOMER);
  });

  it('rejects invalid roles', () => {
    expect(() =>
      parseAuthUser({
        userId: 'u1',
        email: 'shopper@minirue.com',
        role: 'customer',
      }),
    ).toThrow('Session role is not in the canonical vocabulary');
  });
});
