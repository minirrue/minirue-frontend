'use client';

import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useClientQuery } from '@/lib/hooks/use-client-query';
import { useUser } from '@/lib/hooks/use-auth';
import {
  apiGetWishlistIds,
  apiToggleWishlist,
  apiGetWishlistProducts,
} from '@/lib/api/wishlist';

export const WISHLIST_IDS_KEY = ['customer', 'wishlist', 'ids'] as const;
export const WISHLIST_PRODUCTS_KEY = ['customer', 'wishlist', 'products'] as const;

/**
 * Every saved product id, fetched once and shared.
 *
 * A grid can hold twenty hearts; asking the server per heart would be twenty
 * requests to draw one page. React Query keeps the single answer, so a card
 * rendered later reads it from cache rather than fetching again.
 *
 * Signed-out visitors never fetch — there is nothing saved against nobody.
 */
export function useWishlistIds() {
  const { data: user } = useUser();
  return useClientQuery({
    queryKey: WISHLIST_IDS_KEY,
    queryFn: apiGetWishlistIds,
    enabled: !!user,
    staleTime: 1000 * 60,
    retry: false,
  });
}

/** Full product cards for the Saved page. */
export function useWishlistProducts() {
  const { data: user } = useUser();
  return useClientQuery({
    queryKey: WISHLIST_PRODUCTS_KEY,
    queryFn: apiGetWishlistProducts,
    enabled: !!user,
    retry: false,
  });
}

/**
 * Whether one product is saved, and a way to flip it.
 *
 * The flip is optimistic: the heart fills under the finger and is put back if
 * the server disagrees. A heart that waits for a round trip before colouring
 * feels broken on a phone, and this is the most-tapped control on the page.
 */
export function useWishlistToggle(productId: string) {
  const { data: user } = useUser();
  const queryClient = useQueryClient();
  const { data: ids } = useWishlistIds();

  const saved = React.useMemo(
    () => (ids ?? []).includes(productId),
    [ids, productId],
  );

  const mutation = useMutation({
    mutationFn: () => apiToggleWishlist(productId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: WISHLIST_IDS_KEY });
      const previous = queryClient.getQueryData<string[]>(WISHLIST_IDS_KEY) ?? [];
      queryClient.setQueryData<string[]>(
        WISHLIST_IDS_KEY,
        previous.includes(productId)
          ? previous.filter((id) => id !== productId)
          : [...previous, productId],
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      // Put it back rather than leaving a heart that lies.
      if (context?.previous) {
        queryClient.setQueryData(WISHLIST_IDS_KEY, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: WISHLIST_IDS_KEY });
      void queryClient.invalidateQueries({ queryKey: WISHLIST_PRODUCTS_KEY });
    },
  });

  return {
    saved,
    /** False for a signed-out visitor — the caller sends them to sign in. */
    canSave: !!user,
    toggle: mutation.mutate,
    pending: mutation.isPending,
  };
}
