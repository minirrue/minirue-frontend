import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useClientQuery } from '@/lib/hooks/use-client-query';
import {
  apiGetMe,
  apiUpdateMe,
  apiUploadMyAvatar,
  apiGetAddresses,
  apiCreateAddress,
  apiDeleteAddress,
  apiSetDefaultAddress,
  type CustomerProfile,
  type ProfileUpdateInput,
  type Address,
  type AddressInput,
} from '@/lib/api/customers';

export const CUSTOMER_PROFILE_KEY = ['customer', 'me'] as const;
export const CUSTOMER_ADDRESSES_KEY = ['customer', 'addresses'] as const;

export function useCustomerProfile(options?: { enabled?: boolean }) {
  return useClientQuery({
    queryKey: CUSTOMER_PROFILE_KEY,
    queryFn: apiGetMe,
    // Defaults to always-on (every existing caller relies on that), but
    // Header.tsx — rendered for signed-out shoppers too — passes
    // `enabled: signedIn` so a guest browsing the storefront never fires an
    // authenticated request that can only 401.
    enabled: options?.enabled ?? true,
  });
}

export function useUpdateCustomerProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProfileUpdateInput) => apiUpdateMe(input),
    onSuccess: (profile: CustomerProfile) => {
      queryClient.setQueryData(CUSTOMER_PROFILE_KEY, profile);
    },
  });
}

export function useUploadCustomerAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File | Blob) => apiUploadMyAvatar(file),
    onSuccess: (profile: CustomerProfile) => {
      queryClient.setQueryData(CUSTOMER_PROFILE_KEY, profile);
    },
  });
}

export function useCustomerAddresses() {
  return useClientQuery({
    queryKey: CUSTOMER_ADDRESSES_KEY,
    queryFn: apiGetAddresses,
  });
}

export function useCreateCustomerAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AddressInput) => apiCreateAddress(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CUSTOMER_ADDRESSES_KEY });
      queryClient.invalidateQueries({ queryKey: CUSTOMER_PROFILE_KEY });
    },
  });
}

export function useDeleteCustomerAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDeleteAddress(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CUSTOMER_ADDRESSES_KEY });
      queryClient.invalidateQueries({ queryKey: CUSTOMER_PROFILE_KEY });
    },
  });
}

export function useSetDefaultCustomerAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiSetDefaultAddress(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CUSTOMER_ADDRESSES_KEY });
      queryClient.invalidateQueries({ queryKey: CUSTOMER_PROFILE_KEY });
    },
  });
}
