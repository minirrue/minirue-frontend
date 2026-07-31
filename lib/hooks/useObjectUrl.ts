'use client';

import React from 'react';

/**
 * A single object URL for a local File/Blob, created on mount/change and
 * revoked on replacement or unmount. Extracted out of WriteReviewSheet.tsx's
 * own attachment-preview logic (which had this exact lifecycle inlined
 * twice) so a third caller — the just-submitted review's local-first video
 * preview (ReviewMediaStrip.tsx) — doesn't duplicate it a third time.
 */
export function useObjectUrl(file: File | Blob | null | undefined): string | null {
  const [url, setUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return url;
}
