import { z } from 'zod';

export const checkoutAddressSchema = z.object({
  shippingAddressId: z.string().uuid(),
});

export const checkoutPaymentSchema = z.object({
  paymentMethod: z.enum(['COD', 'INSTAPAY']),
  receiptDataUrl: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.paymentMethod === 'INSTAPAY' && !data.receiptDataUrl) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Upload a receipt image for Instapay',
      path: ['receiptDataUrl'],
    });
  }
});

export type CheckoutAddressInput = z.infer<typeof checkoutAddressSchema>;
export type CheckoutPaymentInput = z.infer<typeof checkoutPaymentSchema>;

/** COD limit in minor units — mirrors backend `COD_MAX_ORDER_MINOR`. */
export const COD_MAX_ORDER_MINOR = 50_000;

/** Flat shipping in minor units — mirrors backend checkout shipping. */
export const SHIPPING_AMOUNT_MINOR = 5_000;

export function subtotalToMinor(subtotalAmount: string): number {
  return Math.round(parseFloat(subtotalAmount || '0') * 100);
}

export function orderTotalMinor(subtotalAmount: string): number {
  return subtotalToMinor(subtotalAmount) + SHIPPING_AMOUNT_MINOR;
}

export function isCodAvailable(subtotalAmount: string): boolean {
  return orderTotalMinor(subtotalAmount) <= COD_MAX_ORDER_MINOR;
}
