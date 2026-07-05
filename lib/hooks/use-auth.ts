import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useClientQuery } from '@/lib/hooks/use-client-query';
import { apiLogin, apiRegister, apiLogout, apiMe, type AuthResponse } from '@/lib/api/auth';
import { getRefreshToken } from '@/lib/auth/tokens';
import { setSession } from '@/lib/session';
import { syncCartAfterAuth } from '@/lib/cart/sync-after-auth';
import { CUSTOMER_ADDRESSES_KEY, CUSTOMER_PROFILE_KEY } from '@/lib/hooks/use-customer';

const AUTH_QUERY_KEY = ['auth'];
const ME_QUERY_KEY = ['auth', 'me'];

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      return apiLogin(email, password);
    },
    onSuccess: async (data: AuthResponse) => {
      setSession({
        userId: data.user.userId,
        email: data.user.email,
        name: data.user.name ?? data.user.email.split('@')[0],
        role: data.user.role,
        createdAt: Date.now(),
      });
      queryClient.setQueryData(ME_QUERY_KEY, data.user);
      queryClient.invalidateQueries({ queryKey: CUSTOMER_PROFILE_KEY });
      queryClient.invalidateQueries({ queryKey: CUSTOMER_ADDRESSES_KEY });
      await syncCartAfterAuth();
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      name,
      email,
      password,
    }: {
      name: string;
      email: string;
      password: string;
    }) => {
      return apiRegister(name, email, password);
    },
    onSuccess: async (data: AuthResponse) => {
      setSession({
        userId: data.user.userId,
        email: data.user.email,
        name: data.user.name ?? '',
        role: data.user.role,
        createdAt: Date.now(),
      });
      queryClient.setQueryData(ME_QUERY_KEY, data.user);
      queryClient.invalidateQueries({ queryKey: CUSTOMER_PROFILE_KEY });
      queryClient.invalidateQueries({ queryKey: CUSTOMER_ADDRESSES_KEY });
      await syncCartAfterAuth();
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        await apiLogout(refreshToken);
      }
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: AUTH_QUERY_KEY });
      queryClient.removeQueries({ queryKey: ME_QUERY_KEY });
      queryClient.removeQueries({ queryKey: CUSTOMER_PROFILE_KEY });
      queryClient.removeQueries({ queryKey: CUSTOMER_ADDRESSES_KEY });
    },
  });
}

export function useUser() {
  return useClientQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: apiMe,
    staleTime: 1000 * 60 * 15,
    retry: false,
  });
}
