const mockApiFetch = jest.fn();
const mockApiUpdateMe = jest.fn();

jest.mock('@/lib/api/client', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

jest.mock('@/lib/api/customers', () => ({
  apiUpdateMe: (...args: unknown[]) => mockApiUpdateMe(...args),
}));

jest.mock('@/lib/auth/tokens', () => ({
  markAuthenticated: jest.fn(),
}));

import { apiRegister } from '@/lib/api/auth';

const identity = {
  id: 'user-1',
  email: 'nour@example.com',
  name: 'Nour Hassan',
  role: 'CUSTOMER',
};

describe('registration phone attachment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiFetch.mockResolvedValue({ user: identity });
  });

  it('does not hide a failed authenticated profile PATCH', async () => {
    const cause = { status: 409, message: 'Phone already exists' };
    mockApiUpdateMe.mockRejectedValue(cause);

    await expect(apiRegister({
      firstName: 'Nour',
      lastName: 'Hassan',
      email: identity.email,
      password: 'Password1',
      phone: '+201001234567',
    })).rejects.toMatchObject({
      name: 'RegistrationPhoneSaveError',
      cause,
      user: { userId: identity.id, email: identity.email },
    });

    expect(mockApiUpdateMe).toHaveBeenCalledWith({ phone: '+201001234567' });
  });
});
