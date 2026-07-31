import type { MetadataRoute } from "next";
import { catalog } from "@/lib/api/catalog";
import { fetchSpace, fetchSpaces } from "@/lib/api/storefront";
import {
  isIndexableSearchTerm,
  normalizeSearchTerm,
  searchCanonicalPath,
} from "@/lib/search/query";
import { SITE_URL as BASE_URL } from "@/lib/seo/config";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/products`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];
  // NOTE: bare `/search` is no longer listed. It is now `robots: { index: false }`
  // (it is a form, not an answer), and listing a URL you also tell Google not to
  // index is the same self-contradiction as listing a robots-blocked one. The
  // query URLs below are the pages worth submitting.
  // NOTE: /cart, /login, /signup and /forgot are deliberately NOT listed. robots.txt Disallows
  // them, and submitting a URL you also block is a self-contradiction Search Console reports as
  // "Submitted URL blocked by robots.txt" — it degrades trust in the whole sitemap. A sitemap is a
  // list of pages you want INDEXED, not a list of pages that exist.

  // Dynamic products / categories / brands.
  //
  // These were previously wrapped in `catch {}` with no logging. That silence actively hid a real
  // problem: the live sitemap shipped with ZERO product URLs and nobody noticed, because a failed
  // or empty catalog fetch looked identical to a successful one. A sitemap that silently shrinks to
  // 5 links is worse than a build error — it tells Google the site is empty (RULEBOOK §32: a
  // swallowed failure is a falsified success). Now every miss is logged in the build output.
  try {
    const result = await catalog.listProducts({ limit: 1000 });
    for (const p of result.data) {
      entries.push({
        url: `${BASE_URL}/products/${p.slug}`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
    if (result.data.length === 0) {
      console.warn("[sitemap] catalog.listProducts returned 0 products — sitemap has NO product URLs.");
    }
  } catch (err) {
    console.error("[sitemap] catalog.listProducts FAILED — no product URLs in sitemap:", err);
  }

  // Search-query URLs worth submitting. `/search?q=<term>` is a real, indexable,
  // self-canonicalising page with product structured data on it, so the terms a
  // shopper is most likely to type — this shop's own category and brand names —
  // get discovered rather than waiting to be stumbled upon. This is what makes a
  // Google search for "minirue <brand>" able to land on MiniRue's own results
  // page for that brand instead of only on the home page.
  const searchTerms = new Set<string>();

  try {
    const categories = await catalog.listCategories();
    for (const cat of categories) {
      entries.push({
        url: `${BASE_URL}/categories/${cat.slug}`,
        lastModified: new Date(),
        changeFrequency: "daily",
        priority: 0.7,
      });
      searchTerms.add(cat.name);
    }
  } catch (err) {
    console.error("[sitemap] catalog.listCategories FAILED — no category URLs in sitemap:", err);
  }

  try {
    // Partners live at /<slug> now, not /brands/<slug> — a root-level path is
    // the whole reason that address was chosen, and indexing the old one would
    // point Google at a permanent redirect. Their own categories are listed
    // too: /helia/jewellery is a real page with its own products.
    const spaces = await fetchSpaces();
    for (const space of spaces) {
      if (space.kind === 'HOUSE') continue; // the house IS the domain root
      entries.push({
        url: `${BASE_URL}/${space.slug}`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.7,
      });
      searchTerms.add(space.name);

      try {
        const detail = await fetchSpace(space.slug);
        for (const category of detail?.categories ?? []) {
          entries.push({
            url: `${BASE_URL}/${space.slug}/${category.slug}`,
            lastModified: new Date(),
            changeFrequency: "weekly",
            priority: 0.6,
          });
        }
      } catch {
        // One partner's categories failing must not empty the whole sitemap.
      }
    }
  } catch (err) {
    console.error("[sitemap] fetchSpaces FAILED — no partner URLs in sitemap:", err);
  }

  // Two rules this loop exists to keep:
  //
  // 1. Submit the CANONICAL url, not a variant of it. `?q=Perfumes` canonicalises
  //    to `?q=perfumes`, so submitting the capitalised one asks Google to index a
  //    URL the page itself disowns.
  // 2. Submit only pages that will actually be indexable. A search page with zero
  //    results is `noindex` by design, and listing a noindex URL in a sitemap is
  //    the same self-contradiction as listing a robots-blocked one — the very
  //    thing the note at the top of this file warns about. So each term is
  //    verified against the real search endpoint before it is included.
  const verified = await Promise.all(
    [...searchTerms].map(async (raw) => {
      const term = normalizeSearchTerm(raw);
      if (!isIndexableSearchTerm(term)) return null;
      try {
        const res = await catalog.search(term);
        return res.meta.total > 0 ? term : null;
      } catch {
        // Unverifiable is not the same as empty, but a term we could not check
        // is one we should not vouch for in a sitemap.
        return null;
      }
    }),
  );

  const includedTerms = [...new Set(verified.filter((t): t is string => t !== null))];
  for (const term of includedTerms) {
    entries.push({
      url: `${BASE_URL}${searchCanonicalPath(term)}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      // Below the canonical /categories and partner pages on purpose: a search
      // URL is a second route to the same goods, not a competitor to them.
      priority: 0.4,
    });
  }
  const skipped = searchTerms.size - includedTerms.length;
  if (skipped > 0) {
    console.warn(`[sitemap] ${skipped} search term(s) skipped — no results or unverifiable.`);
  }

  console.log(`[sitemap] generated ${entries.length} URLs.`);
  return entries;
}
