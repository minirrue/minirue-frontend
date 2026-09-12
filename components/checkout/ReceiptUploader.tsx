'use client';

import { CheckoutFileDrop, CheckoutSection } from './checkout-ui';
import { RECEIPT_ACCEPT, RECEIPT_HINT } from '@/lib/checkout/receipt-formats';

export interface ReceiptUploaderProps {
  preview: string | null;
  onFile: (file: File | null) => void;
  hint?: string;
}

export default function ReceiptUploader({
  preview,
  onFile,
  hint = RECEIPT_HINT,
}: ReceiptUploaderProps) {
  return (
    <CheckoutSection title="Payment proof">
      <CheckoutFileDrop
        accept={RECEIPT_ACCEPT}
        onFile={onFile}
        preview={preview}
        hint={hint}
      />
    </CheckoutSection>
  );
}
