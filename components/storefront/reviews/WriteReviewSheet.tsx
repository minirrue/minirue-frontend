'use client';

import React from 'react';
import MobileSheet from '@/components/ui/MobileSheet';
import StarRating from '@/components/storefront/StarRating';
import Icon from '@/components/ui/Icon';
import { apiCreateReview, apiAttachReviewMedia } from '@/lib/api/reviews';
import type { ApiError } from '@/lib/api/client';

const MAX_IMAGES = 4;
const MAX_VIDEOS = 1;
const BODY_MAX = 4000;

interface WriteReviewSheetProps {
  open: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  onWritten: () => void;
}

interface Attachment {
  file: File;
  kind: 'IMAGE' | 'VIDEO';
  previewUrl: string;
}

function kindOf(file: File): 'IMAGE' | 'VIDEO' | null {
  if (file.type.startsWith('image/')) return 'IMAGE';
  if (file.type.startsWith('video/')) return 'VIDEO';
  return null;
}

export default function WriteReviewSheet({
  open,
  onClose,
  productId,
  productName,
  onWritten,
}: WriteReviewSheetProps) {
  const [rating, setRating] = React.useState(0);
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [attachments, setAttachments] = React.useState<Attachment[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  // Object URLs are a memory leak if they are never handed back. This used to
  // register with a `[]` dep array, so its closure only ever saw the initial
  // (empty) `attachments` and revoked nothing on unmount — every URL created
  // after mount leaked.
  //
  // Putting `attachments` directly in this effect's own deps would be a
  // different bug: React runs the PREVIOUS cleanup before every dependency
  // change, so simply adding one more photo (a new array reference) would
  // immediately revoke the URLs already on screen, breaking their previews
  // while they are still attached. A ref sidesteps that — it is kept in sync
  // on every change but the unmount-only effect below reads its *current*
  // value at cleanup time, not a stale closure over the first render.
  const attachmentsRef = React.useRef(attachments);
  React.useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  React.useEffect(() => {
    return () => {
      attachmentsRef.current.forEach((a) => URL.revokeObjectURL(a.previewUrl));
    };
  }, []);

  const imageCount = attachments.filter((a) => a.kind === 'IMAGE').length;
  const videoCount = attachments.filter((a) => a.kind === 'VIDEO').length;

  function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const next: Attachment[] = [];
    let images = imageCount;
    let videos = videoCount;

    for (const file of Array.from(files)) {
      const kind = kindOf(file);
      if (!kind) {
        setError('Attach a photo or a video.');
        continue;
      }
      if (kind === 'IMAGE' && images >= MAX_IMAGES) {
        setError(`You can add up to ${MAX_IMAGES} photos.`);
        continue;
      }
      if (kind === 'VIDEO' && videos >= MAX_VIDEOS) {
        setError('You can add one video.');
        continue;
      }
      if (kind === 'IMAGE') images += 1;
      else videos += 1;
      next.push({ file, kind, previewUrl: URL.createObjectURL(file) });
    }

    if (next.length) setAttachments((prev) => [...prev, ...next]);
    // Reset so choosing the same file twice still fires a change event.
    if (fileRef.current) fileRef.current.value = '';
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function submit() {
    if (rating < 1) {
      setError('Choose a rating from 1 to 5 stars.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const review = await apiCreateReview({
        productId,
        rating,
        title: title.trim() || undefined,
        body: body.trim() || undefined,
      });

      // Uploaded one at a time and in order, so a failure half way leaves the
      // review and the photos that did land, rather than losing everything.
      for (const attachment of attachments) {
        await apiAttachReviewMedia(review.id, attachment.file);
      }

      setDone(true);
      onWritten();
    } catch (e) {
      const err = e as ApiError;
      setError(
        err.message ||
          'Something went wrong sending that. Please try again in a moment.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    onClose();
    // Reset after the sheet has slid away, so the form does not visibly empty
    // itself on the way out.
    setTimeout(() => {
      setDone(false);
      setError(null);
      if (done) {
        setRating(0);
        setTitle('');
        setBody('');
        attachments.forEach((a) => URL.revokeObjectURL(a.previewUrl));
        setAttachments([]);
      }
    }, 600);
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 'var(--mr-radius-md)',
    border: '1px solid var(--mr-border)',
    background: 'var(--mr-cream-200)',
    fontFamily: 'var(--mr-font-ui)',
    fontSize: 'var(--mr-text-base)',
    color: 'var(--mr-fg)',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: 8,
    fontFamily: 'var(--mr-font-label)',
    fontSize: 'var(--mr-text-xs)',
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: 'var(--mr-fg-3)',
  };

  if (done) {
    return (
      <MobileSheet
        open={open}
        onClose={handleClose}
        title="Thank you"
        traceId="PG-STOREFRONT-CAT-005::EL-REGION-review-sent"
      >
        <p
          style={{
            fontFamily: 'var(--mr-font-serif)',
            fontStyle: 'italic',
            fontSize: 'var(--mr-text-lg)',
            lineHeight: 1.5,
            color: 'var(--mr-fg)',
            margin: '8px 0 16px',
          }}
        >
          Your review of {productName} is with us.
        </p>
        <p style={{ color: 'var(--mr-fg-2)', lineHeight: 1.6, margin: 0 }}>
          Every review is read before it goes on the shop, so it will appear here
          shortly rather than straight away.
        </p>
      </MobileSheet>
    );
  }

  return (
    <MobileSheet
      open={open}
      onClose={handleClose}
      title={`Review ${productName}`}
      traceId="PG-STOREFRONT-CAT-005::EL-REGION-write-review"
      footer={
        <button
          type="button"
          onClick={() => void submit()}
          disabled={submitting || rating < 1}
          data-trace-id="PG-STOREFRONT-CAT-005::EL-BTN-submit-review"
          style={{
            width: '100%',
            padding: '16px 24px',
            borderRadius: 'var(--mr-radius-pill)',
            background: 'var(--mr-ink-900)',
            color: 'var(--mr-cream-100)',
            border: 0,
            cursor: submitting || rating < 1 ? 'not-allowed' : 'pointer',
            opacity: submitting || rating < 1 ? 0.55 : 1,
            fontFamily: 'var(--mr-font-label)',
            fontSize: 'var(--mr-text-xs)',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            minHeight: 48,
            transition: 'opacity var(--mr-dur-fast), background var(--mr-dur-fast)',
          }}
        >
          {submitting ? 'Sending…' : 'Send review'}
        </button>
      }
    >
      <div style={{ marginBottom: 24 }}>
        <span style={labelStyle}>How was it?</span>
        <StarRating value={rating} onChange={setRating} size={20} />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle} htmlFor="review-title">
          A headline (optional)
        </label>
        <input
          id="review-title"
          type="text"
          value={title}
          maxLength={150}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Warmer than I expected"
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle} htmlFor="review-body">
          In your words (optional)
        </label>
        <textarea
          id="review-body"
          value={body}
          maxLength={BODY_MAX}
          rows={5}
          onChange={(e) => setBody(e.target.value)}
          placeholder="How it wears, how long it lasts, whether it is what you hoped for."
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
        />
        {body.length > BODY_MAX - 200 ? (
          <span
            style={{
              display: 'block',
              marginTop: 6,
              fontSize: 'var(--mr-text-xs)',
              color: 'var(--mr-fg-3)',
            }}
          >
            {BODY_MAX - body.length} characters left
          </span>
        ) : null}
      </div>

      <div style={{ marginBottom: 8 }}>
        <span style={labelStyle}>
          Photos and a video (optional)
        </span>
        <p
          style={{
            margin: '0 0 12px',
            fontSize: 'var(--mr-text-sm)',
            color: 'var(--mr-fg-2)',
            lineHeight: 1.5,
          }}
        >
          Up to {MAX_IMAGES} photos and one short video of what arrived.
        </p>

        {attachments.length ? (
          <div className="flex flex-wrap gap-2" style={{ marginBottom: 12 }}>
            {attachments.map((a, i) => (
              <div
                key={a.previewUrl}
                style={{
                  position: 'relative',
                  width: 72,
                  height: 72,
                  borderRadius: 'var(--mr-radius-md)',
                  overflow: 'hidden',
                  border: '1px solid var(--mr-hairline)',
                  background: 'var(--mr-cream-300)',
                }}
              >
                {a.kind === 'IMAGE' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.previewUrl}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <video
                    src={a.previewUrl}
                    muted
                    playsInline
                    preload="metadata"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                )}
                <button
                  type="button"
                  onClick={() => removeAttachment(i)}
                  aria-label={
                    a.kind === 'IMAGE' ? 'Remove this photo' : 'Remove this video'
                  }
                  style={{
                    position: 'absolute',
                    top: 2,
                    right: 2,
                    width: 24,
                    height: 24,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: '50%',
                    border: 0,
                    background: 'rgba(11,11,11,0.62)',
                    color: 'var(--mr-cream-100)',
                    cursor: 'pointer',
                  }}
                >
                  <Icon name="close" size={12} />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={(e) => addFiles(e.target.files)}
          style={{ display: 'none' }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={imageCount >= MAX_IMAGES && videoCount >= MAX_VIDEOS}
          data-trace-id="PG-STOREFRONT-CAT-005::EL-BTN-add-review-media"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 18px',
            minHeight: 44,
            borderRadius: 'var(--mr-radius-pill)',
            border: '1px dashed var(--mr-border)',
            background: 'transparent',
            color: 'var(--mr-fg-2)',
            cursor: 'pointer',
            fontFamily: 'var(--mr-font-label)',
            fontSize: 'var(--mr-text-xs)',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
          }}
        >
          <Icon name="plus" size={13} /> Add a photo or video
        </button>
      </div>

      {error ? (
        <p
          role="alert"
          style={{
            margin: '12px 0 0',
            color: 'var(--mr-crimson-500)',
            fontSize: 'var(--mr-text-sm)',
            lineHeight: 1.5,
          }}
        >
          {error}
        </p>
      ) : null}
    </MobileSheet>
  );
}
