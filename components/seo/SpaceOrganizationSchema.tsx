import { JsonLd } from "./JsonLd";
import type { StorefrontSpace } from "@/lib/api/storefront";
import { SITE_URL as BASE_URL } from "@/lib/seo/config";

/**
 * A partner's own Organization node, mounted on its space page (`/[slug]`).
 *
 * `StorefrontSpace` carries only `name`, `description` and `logoUrl` — no
 * partner website, social or contact field exists in the API today (verified
 * against `lib/api/storefront.ts`) — so `sameAs` is never emitted, stubbed
 * empty, or invented. `logoUrl` is already an absolute URL, so it's used
 * as-is for both `logo` and `image` rather than prefixed with `SITE_URL`.
 *
 * Deliberately never called for `kind === 'HOUSE'` (the caller,
 * `app/[slug]/page.tsx`, gates on this) — a HOUSE space is MiniRue itself,
 * which already has its own Organization node at `${BASE_URL}/#organization`
 * (`OrganizationSchema.tsx`). A second, competing Organization for the same
 * entity here would dilute that entity signal rather than reinforce it.
 */
export function buildSpaceOrganizationSchema(space: StorefrontSpace): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: space.name,
    url: `${BASE_URL}/${space.slug}`,
    ...(space.description ? { description: space.description } : {}),
    ...(space.logoUrl ? { logo: space.logoUrl, image: space.logoUrl } : {}),
  };
}

export default function SpaceOrganizationSchema({ space }: { space: StorefrontSpace }) {
  return <JsonLd data={buildSpaceOrganizationSchema(space)} />;
}
