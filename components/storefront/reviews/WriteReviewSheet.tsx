'use client';

import React from 'react';
import MobileSheet from '@/components/ui/MobileSheet';
import StarRating from '@/components/storefront/StarRating';
import Icon from '@/components/ui/Icon';
import { apiCreateReview, apiAttachReviewMedia, type ReviewMedia } from '@/lib/api/reviews';
import { formatApiError, type ApiError } from '@/lib/api/client';
import { capturePosterFrame } from '@/lib/media/capture-poster-frame';
import ReviewMediaStrip, {
  type LocalReviewMedia,
} from '@/components/storefront/reviews/ReviewMediaStrip';

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
  /** A VIDEO's poster frame, captured locally off this same file (see
   * capturePosterFrame) — undefined while capture is still running, null if
   * it failed or this attachment is a photo. */
  posterBlob?: Blob | null;
  /** Local object URL for `posterBlob`, so the thumbnail the customer sees
   * while composing is the same real thumbnail that ships with the review —
   * never a network round trip, so it can never show broken pre-submit. */
  posterPreviewUrl?: string | null;
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
  // What the server actually stored, so the "done" screen renders through
  // the exact same component (ReviewMediaStrip) the eventual approved
  // review uses — with `localMediaById` filling in this session's own
  // bytes so nothing is ever shown broken while the just-uploaded URLs are
  // still cold.
  const [submittedMedia, setSubmittedMedia] = React.useState<ReviewMedia[]>([]);
  const [localMediaById, setLocalMediaById] = React.useState<Record<string, LocalReviewMedia>>({});
  const fileRef = React.useRef<HTMLInputElement>(null);
  // Poster capture runs in the background off the local file (see
  // capturePosterFrame) and usually finishes well before the customer
  // presses Send. On the rare chance it hasn't, `submit` awaits the
  // in-flight promise here rather than uploading the video with whatever
  // poster state happened to have landed first — keyed by `previewUrl`,
  // stable for an attachment's whole lifetime.
  const posterCapturesRef = React.useRef(new Map<string, Promise<Blob | null>>());

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
      attachmentsRef.current.forEach((a) => {
        URL.revokeObjectURL(a.previewUrl);
        if (a.posterPreviewUrl) URL.revokeObjectURL(a.posterPreviewUrl);
      });
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

    // Grab a poster frame for every video just added, off the browser's own
    // local decode of the file — never the server. Runs after the state
    // update above so a slow capture never delays showing the attachment
    // itself; the thumbnail simply upgrades from "playing video preview" to
    // "poster frame" once ready, matched back to its attachment by
    // `previewUrl` (stable for this attachment's whole lifetime).
    for (const attachment of next) {
      if (attachment.kind !== 'VIDEO') continue;
      const capture = capturePosterFrame(attachment.file).then((blob) => {
        setAttachments((prev) =>
          prev.map((a) =>
            a.previewUrl === attachment.previewUrl
              ? { ...a, posterBlob: blob, posterPreviewUrl: blob ? URL.createObjectURL(blob) : null }
              : a,
          ),
        );
        return blob;
      });
      posterCapturesRef.current.set(attachment.previewUrl, capture);
    }
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => {
      const target = prev[index];
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
        if (target.posterPreviewUrl) URL.revokeObjectURL(target.posterPreviewUrl);
      }
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
      // Each call returns the review's FULL media list so far, in the same
      // (sortOrder, createdAt) order attachments were added in — the last
      // response is therefore exactly `attachments`, zipped 1:1, once every
      // upload has landed.
      let lastResponseMedia: ReviewMedia[] = [];
      for (const attachment of attachments) {
        // If this video's poster capture is still running, wait for it — a
        // customer who fills in the form quickly can otherwise reach Send
        // before the browser has finished decoding the local file, and
        // uploading with `posterBlob` still `undefined` would ship a video
        // with no thumbnail for no reason other than timing.
        const pendingPoster = posterCapturesRef.current.get(attachment.previewUrl);
        const poster = attachment.posterBlob !== undefined
          ? attachment.posterBlob
          : pendingPoster
            ? await pendingPoster
            : null;
        const result = await apiAttachReviewMedia(review.id, attachment.file, poster);
        lastResponseMedia = result.media;
      }

      // Local-first (task 41, 2026-07-31): match each server-created media
      // row back to the local bytes it came from, purely by upload order —
      // there is no other shared key, since the media id is only assigned
      // server-side. Threaded into ReviewMediaStrip below so the customer's
      // own just-submitted photo/video/poster never has to wait on the
      // guaranteed-cold first request for its resolved URL.
      const localById: Record<string, LocalReviewMedia> = {};
      lastResponseMedia.forEach((m, i) => {
        const attachment = attachments[i];
        if (!attachment) return;
        localById[m.id] = { file: attachment.file, posterFile: attachment.posterBlob };
      });
      setSubmittedMedia(lastResponseMedia);
      setLocalMediaById(localById);

      setDone(true);
      onWritten();
    } catch (e) {
      setError(
        formatApiError(
          e,
          'Something went wrong sending that. Please try again in a moment.',
        ),
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
        attachments.forEach((a) => {
          URL.revokeObjectURL(a.previewUrl);
          if (a.posterPreviewUrl) URL.revokeObjectURL(a.posterPreviewUrl);
        });
        posterCapturesRef.current.clear();
        setAttachments([]);
        setSubmittedMedia([]);
        setLocalMediaById({});
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

        {/* What was just sent — the SAME component (ReviewMediaStrip) an
            approved review uses, so this is exactly what the review will
            look like once it's live, not a stand-in. `localMediaById`
            supplies this session's own bytes so nothing here ever shows
            broken while the resolved URL the server just returned is still
            a guaranteed-cold cache miss. */}
        <ReviewMediaStrip media={submittedMedia} localMediaById={localMediaById} />
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
