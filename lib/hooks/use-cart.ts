import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';

export interface CartItem {
  id: string;
  cartId: string;
  variantId: string;
  productId: string;
  quantity: number;
  price_amount: string;
  price_currency: string;
  created_at: string;
  updated_at: string;
}

export interface Cart {
  id: string;
  userId: string;
  items: CartItem[];
  total_amount: string;
  total_currency: string;
  item_count: number;
  created_at: string;
  updated_at: string;
}

export interface AddCartItemRequest {
  variantId: string;
  quantity: number;
}

export interface UpdateCartItemRequest {
  quantity: number;
}

const CART_QUERY_KEY = ['cart'];

export function useCart() {
  return useQuery({
    queryKey: CART_QUERY_KEY,
    queryFn: async () => {
      return apiFetch<Cart>('/cart', { auth: true });
    },
    enabled: typeof window !== 'undefined',
  });
}

export function useAddCartItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: AddCartItemRequest) => {
      return apiFetch<CartItem>('/cart/items', {
        method: 'POST',
        auth: true,
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
    },
  });
}

export function useUpdateCartItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, ...data }: { itemId: string } & UpdateCartItemRequest) => {
      return apiFetch<CartItem>(`/cart/items/${itemId}`, {
        method: 'PATCH',
        auth: true,
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
    },
  });
}

export function useRemoveCartItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      return apiFetch<void>(`/cart/items/${itemId}`, {
        method: 'DELETE',
        auth: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
    },
  });
}

export function useClearCart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      return apiFetch<void>('/cart/items', {
        method: 'DELETE',
        auth: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
    },
  });
}
