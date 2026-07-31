# SEO setup — search engine verification

Two environment variables put a verification `<meta>` tag in the storefront's `<head>` so Google and
Bing will accept ownership of `minirueshop.com`. Neither has ever been set, which is why the site is
not verified in Search Console.

| Variable | Value | Needed? |
|---|---|---|
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | The `content` value from Search Console's HTML-tag method | **Yes** |
| `NEXT_PUBLIC_BING_SITE_VERIFICATION` | The `msvalidate.01` content value from Bing Webmaster Tools | Optional |

Both are read in `app/layout.tsx:90-93`, inside `generateMetadata`. When a variable is unset the tag
is simply omitted — there is no error and no warning, which is exactly how this went unnoticed.

Google verification is the single highest-value item in the storefront's SEO backlog. Without a
verified property you cannot submit the sitemap, cannot request indexing, and cannot see why pages
are or aren't being indexed. On a domain under three months old that is usually the binding
constraint, ahead of anything in the code.

---

## Read this first: `NEXT_PUBLIC_*` is baked in at build time

Next.js inlines every `NEXT_PUBLIC_*` variable into the bundle when the app is **built**, not when it
runs. Setting the value in Vercel does nothing on its own — **you must redeploy afterwards**, and the
redeploy must not reuse a cached build.

This is the most common way this task appears to fail: the value is set correctly, the deployment is
never rebuilt, the meta tag never appears, and Search Console keeps reporting verification failure.

---

## 1. Google Search Console

1. Go to <https://search.google.com/search-console> and sign in.
2. **Add property** → choose the **URL prefix** box (not Domain) → enter `https://minirueshop.com`.
   - The *Domain* option verifies by DNS instead and does not use this variable at all. If you'd
     rather verify by DNS, that works fine and you can skip these variables entirely — but the URL
     prefix property is worth having regardless, because its reports are per-URL.
3. On the verification screen, expand **HTML tag**. You'll see something like:

   ```html
   <meta name="google-site-verification" content="AbC123_xYz...">
   ```

4. Copy **only the `content` value** — `AbC123_xYz...`. Do not copy the whole tag, the quotes, or
   the `name` attribute. The code builds the tag around this value; pasting the full tag produces
   malformed HTML and verification will fail.
5. Set it in Vercel (below), redeploy, then come back and press **Verify**.

Keep the property verified afterwards — Google re-checks periodically, and removing the variable in a
later deploy will un-verify the site.

## 2. Bing Webmaster Tools (optional)

Worth doing: Bing's index also feeds ChatGPT search.

1. Go to <https://www.bing.com/webmasters> and sign in.
2. You can **import** the property directly from Google Search Console once step 1 is verified —
   this is the fastest route and needs no variable at all.
3. To verify manually instead: **Add site** → choose the **HTML Meta Tag** option → copy the
   `content` value from `<meta name="msvalidate.01" content="...">` and set it as
   `NEXT_PUBLIC_BING_SITE_VERIFICATION`.

## 3. Set the variables in Vercel

1. Vercel → the `minirue-frontend` project → **Settings** → **Environment Variables**.
2. Add each variable. Tick **Production** at minimum; ticking Preview and Development too is harmless
   and keeps builds consistent.
3. **Deployments** → most recent → **⋯** → **Redeploy**, and **untick "Use existing build cache"**.
   A cached build reuses the previously inlined values and the tag will not appear.

While you're in that project's settings, confirm **Build Command** is `npm run build`. A bare
`next build` skips `scripts/seo-check.mjs`, the post-build SEO guard.

## 4. Confirm the tag actually shipped

After the redeploy finishes:

```bash
curl -s https://minirueshop.com | grep -i "site-verification\|msvalidate"
```

Expected output (one line per variable you set):

```html
<meta name="google-site-verification" content="AbC123_xYz..."/>
```

If nothing prints, the variable is unset, was set after the last build, or the redeploy used the
build cache. Check in that order — it is almost always the cache.

Only once you see the tag should you press **Verify** in Search Console.

---

## What to do immediately after verifying

Verification is the gate; these are the steps it unlocks, in order:

1. **Submit the sitemap** — Search Console → Sitemaps → enter `sitemap.xml`.
2. **Request indexing for `/`** — use URL Inspection on `https://minirueshop.com`, then **Request
   Indexing**. Repeat for `/products`, `/categories`, `/brands`, `/collab`.
3. **Watch the Page Indexing report** over the following days for *Discovered – currently not
   indexed* and *Crawled – currently not indexed*. Those two states are the ones worth acting on.
4. **Create a Google Business Profile** for MiniRue. For a young brand this is the strongest single
   signal tying the name "Mini Rue" to this domain.
5. **Make the social profiles corroborate the brand.** `components/seo/OrganizationSchema.tsx`
   declares Facebook, Instagram and TikTok profiles in its `sameAs` array. Confirm all three exist
   and are actually MiniRue's — a `sameAs` pointing at a 404 or at someone else's handle weakens the
   entity rather than strengthening it. Setting each display name to read "MiniRue (Mini Rue)" makes
   the association explicit in both directions.

## Note on the sitemap and an empty catalog

The sitemap is generated at build time from the live catalog API. While the database has no products,
`app/sitemap.ts` logs `catalog.listProducts returned 0 products` during the build and emits only the
static pages. That is expected and not a fault — the sitemap will fill in on the next deploy after
products exist. Submitting it now is still correct; Google re-fetches it.

The post-build guard behaves the same way: it warns that the homepage links no products while the
catalog is empty, and turns that into a hard build failure automatically once the sitemap contains
product URLs. There is nothing to configure for that transition.
