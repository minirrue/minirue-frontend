import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * The site-wide share image is the committed cream logo artwork,
 * `public/og-image.jpg`, served byte for byte.
 *
 * It used to be drawn here with `ImageResponse` in generic serif/sans fonts,
 * which never matched the real mark, while `og-image.jpg` (the share image
 * `SITE_OG_IMAGE` and /search point at) was a different, black-ground
 * picture. Serving the one file from both URLs keeps every share preview the
 * same brand image.
 *
 * Node runtime and no request-time APIs, so Next prerenders this at build
 * time: the file is read once, from the project root, during `next build`.
 */
const ogImage = await readFile(join(process.cwd(), 'public', 'og-image.jpg'));

export const alt = 'MiniRue — Original Cosmetics & Perfumes';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/jpeg';

export default async function OgImage() {
  return new Response(new Uint8Array(ogImage), {
    headers: { 'Content-Type': contentType },
  });
}
