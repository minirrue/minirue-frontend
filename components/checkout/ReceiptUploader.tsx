'use client';

import { CheckoutFileDrop, CheckoutSection } from './checkout-ui';

export interface ReceiptUploaderProps {
  preview: string | null;
  onFile: (file: File | null) => void;
  hint?: string;
}

export default function ReceiptUploader({
  preview,
  onFile,
  hint = 'PNG or JPG · max 10 MB · drag and drop supported',
}: ReceiptUploaderProps) {
  return (
    <CheckoutSection title="Payment proof">
      <CheckoutFileDrop
        accept="image/png,image/jpeg"
        onFile={onFile}
        preview={preview}
        hint={hint}
      />
    </CheckoutSection>
  );
}
