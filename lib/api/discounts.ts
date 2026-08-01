import { apiFetch } from './client';

/**
 * Discount codes at checkout.
 *
 * The browser sends the code TEXT and a description of the bag, and is told
 * what it would save. It never sends, and could not send, an amount — the
 * server recomputes everything again at Place order, and that recomputation is
 * the only figure that reaches an order.
 *
 * So this is a display convenience, not a source of truth. If the preview and
 * the placed order ever disagree, the order is right.
 */

export interface DiscountPreviewLine {
  variantId: string;
  qty: number;
  unitPriceMinor: number;
  bundleId?: string | null;
  bundleLineKey?: string;
  bundleListTotalMinor?: number;
}

export interface DiscountPreview {
  valid: boolean;
  code: string | null;
  discountMinor: number;
  eligibleSubtotalMinor: number;
  /** True when the bag also held something a code cannot touch. */
  appliesToMinirueOnly: boolean;
  winner: 'CODE' | 'AUTOMATIC' | null;
  bundleSavingsMinor: number;
  /** Present only on a refusal, and always the same sentence. */
  message: string | null;
}

export async function previewDiscount(
  lines: DiscountPreviewLine[],
  code: string | null,
): Promise<DiscountPreview> {
  return apiFetch<DiscountPreview>('/discounts/preview', {
    method: 'POST',
    body: JSON.stringify({ code, lines }),
    // Sent when the shopper is signed in so a personal code can be checked.
    // A visitor gets the generic refusal for one, which is correct — there is
    // nobody to check it against.
    auth: true,
  });
}

/** localStorage key. The applied code has to survive a refresh mid-checkout. */
const STORAGE_KEY = 'mr-discount-code';

export function loadAppliedCode(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Private browsing, or storage disabled. The code is simply not remembered;
    // it is never a reason the page fails to render.
    return null;
  }
}

export function saveAppliedCode(code: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (code) window.localStorage.setItem(STORAGE_KEY, code);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* see above */
  }
}
