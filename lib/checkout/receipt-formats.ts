/**
 * What a receipt file picker will let a shopper choose.
 *
 * There were two `accept` lists and they disagreed: the InstaPay page allowed
 * `png,jpeg,webp` and the shared `ReceiptUploader` allowed `png,jpeg`. Same
 * upload, same backend, two answers — so which formats a shopper could pick
 * depended on which screen they reached the uploader from.
 *
 * ## Why this is not cosmetic
 *
 * This is the last step of PAYING. The shopper has chosen items, entered an
 * address and made a bank transfer; the receipt is the proof. An `accept` that
 * is narrower than the server's is the worst place to be narrow, because the
 * file picker simply **does not show** the file — on iOS it greys out the
 * photo they are trying to attach with no explanation at all. There is no error
 * to read and nothing to search for.
 *
 * HEIC is the case that matters: it is the iPhone camera default, so "photo of
 * the confirmation" — which the page literally invites — produces a file the
 * old list hid.
 *
 * ## Kept deliberately wide, and in sync with the server
 *
 * The backend identifies a receipt by its magic bytes rather than the mime type
 * the client claims (backend#88), and accepts JPEG, PNG, WebP, GIF, HEIC, HEIF,
 * AVIF, BMP and TIFF. This list mirrors that. `accept` is a picker HINT, never
 * a security boundary — the server is the boundary — so being generous here
 * costs nothing and being stingy costs a sale.
 *
 * `image/*` would be simpler and is tempting. It is avoided on purpose: it also
 * matches formats the server rejects, which turns a greyed-out file into a
 * failed upload after the wait. Naming the list keeps the two ends honest.
 */
export const RECEIPT_ACCEPT = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/avif',
  'image/gif',
  'image/bmp',
  'image/tiff',
  // iOS Safari has historically matched HEIC by extension rather than by media
  // type in a file picker, so the bare extensions are included as well. They are
  // ignored by browsers that do the right thing.
  '.heic',
  '.heif',
].join(',');

/** One sentence under the control. Deliberately not the full nine formats. */
export const RECEIPT_HINT =
  'Any photo or screenshot · max 10 MB · drag and drop supported';
