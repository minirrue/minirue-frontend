/**
 * The storefront's canonical origin, with no trailing slash.
 *
 * Every SEO consumer (canonicals, JSON-LD `@id`/`url`, the sitemap, share
 * links) builds its URLs by concatenating a path directly onto this
 * constant — `${SITE_URL}/products/${slug}`, `${SITE_URL}/#organization` —
 * so a trailing slash here would silently double up into `.../products/`
 * style URLs everywhere. Normalise once, here, instead of at every call
 * site: if `NEXT_PUBLIC_SITE_URL` is ever set with a trailing slash, it is
 * stripped before anything imports this value.
 *
 * Contract: `NEXT_PUBLIC_SITE_URL`, if set, must be a valid absolute origin
 * (e.g. `https://minirueshop.com`). Only trailing-slash noise is normalised;
 * other malformed values (blank, whitespace-only, missing a scheme) are not
 * validated or corrected here and will pass through as-is.
 */
const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://minirueshop.com";

export const SITE_URL = rawSiteUrl.replace(/\/+$/, "");
