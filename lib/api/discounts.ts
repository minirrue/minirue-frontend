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

/**
 * The one refusal sentence the server ever sends for a code, whatever the real
 * reason. Matched exactly so a 422 from Place order can be recognised as "the
 * code", not a problem with the address or the bag.
 */
export const INVALID_CODE_MESSAGE = "This code isn't valid.";

/**
 * What Place order shows when the server refused the code. The first sentence
 * is the server's own; the rest says what happened to the order, which is not
 * a reason and so reveals nothing about the code.
 */
export const CODE_REFUSED_AT_PLACEMENT =
  "This code isn't valid. It has been removed and your order was not placed. Please review your total and place the order again.";

/** True for the server's generic code refusal (422 at preview or placement). */
export function isInvalidCodeError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { status?: unknown; message?: unknown };
  return e.status === 422 && e.message === INVALID_CODE_MESSAGE;
}

/**
 * For Place order's catch: when the server refused the CODE, forget the saved
 * code and return the message to show; otherwise null (not a code problem).
 *
 * Forgetting it matters. Placement now refuses a dead code instead of silently
 * charging full price (minirue-backend#120) — so a code left in storage would
 * make every retry fail the same way, with no way out but clearing site data.
 */
export function codeRefusalAtPlacement(err: unknown): string | null {
  if (!isInvalidCodeError(err)) return null;
  saveAppliedCode(null);
  return CODE_REFUSED_AT_PLACEMENT;
}

export async function previewDiscount(
  lines: DiscountPreviewLine[],
  code: string | null,
  opts?: {
    /**
     * A guest's phone from the Delivery step (minirue-backend#120). The server
     * counts a guest's per-customer limit by it, so a code they have already
     * used is refused here rather than at Place order.
     */
    guestPhone?: string;
  },
): Promise<DiscountPreview> {
  return apiFetch<DiscountPreview>('/discounts/preview', {
    method: 'POST',
    body: JSON.stringify({
      code,
      lines,
      ...(opts?.guestPhone ? { guestPhone: opts.guestPhone } : {}),
    }),
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
