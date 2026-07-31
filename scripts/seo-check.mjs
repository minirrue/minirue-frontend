#!/usr/bin/env node
// seo-check.mjs — Task 12 regression guard (SDD batch: "then-superpowers-writing-plans-we-have-
// sparkling-boot").
//
// WHY THIS EXISTS: for months this storefront wrapped the entire <body> in
// <Suspense fallback={null}>, so every prerendered page shipped an EMPTY body — all content,
// including the brand Organization/WebSite JSON-LD, was hidden inside `<div hidden id="S:0">`
// and swapped in by client JS after hydration. Source review never caught it (the JSX looked
// fine) and every existing test passed, because nothing anywhere asserted on the actual
// prerendered HTML bytes. This script reads `next build`'s real output — not source, not
// components — so that class of regression fails the build instead of shipping silently again.
//
// Run: `node scripts/seo-check.mjs` after `next build` has produced `.next/server/app/**.html`.
// Exit 0 = clean. Exit 1 = at least one hard-fail assertion failed (details printed above).
//
// Env:
//   SEO_CHECK_REQUIRE_PRODUCTS=1   Promote the product-link check (see below) to a hard failure
//                                  even when the build looks backend-less. CI sets this once a
//                                  reachable backend is part of the build step; local devs
//                                  without a backend do not set it, and get a warning instead of
//                                  a build break.

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const appDir = path.join(repoRoot, ".next", "server", "app");
const publicDir = path.join(repoRoot, "public");

const failures = [];
const warnings = [];

function fail(file, assertion, detail) {
  failures.push({ file, assertion, detail });
}
function warn(file, assertion, detail) {
  warnings.push({ file, assertion, detail });
}

// ---------------------------------------------------------------------------------------------
// 0. Locate the build output.
// ---------------------------------------------------------------------------------------------

if (!fs.existsSync(appDir)) {
  console.error(
    `seo-check: ${path.relative(repoRoot, appDir)} does not exist — run "next build" first.`,
  );
  process.exit(1);
}

function walkHtml(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkHtml(full));
    } else if (entry.name.endsWith(".html")) {
      out.push(full);
    }
  }
  return out;
}

const htmlFiles = walkHtml(appDir).sort();

if (htmlFiles.length === 0) {
  console.error(`seo-check: no .html files found under ${path.relative(repoRoot, appDir)}.`);
  process.exit(1);
}

console.log(`seo-check: inspecting ${htmlFiles.length} prerendered .html file(s) under ${path.relative(repoRoot, appDir)}/`);

// Next's own synthetic error shell (500 page). It has no title/description/canonical of its own
// and is not a real, indexable route — flagging it for missing metadata teaches nobody anything.
// Detected structurally (id="__next_error__"), not by filename, so it still gets the hidden-body
// and JSON-LD checks like every other file.
function isFrameworkErrorShell(html) {
  return html.includes('id="__next_error__"');
}

// ---------------------------------------------------------------------------------------------
// 1. Hard-fail, environment-independent structural checks — run on every emitted .html file.
// ---------------------------------------------------------------------------------------------

let indexHtml = null;
let indexHtmlPath = null;

for (const file of htmlFiles) {
  const rel = path.relative(repoRoot, file);
  const html = fs.readFileSync(file, "utf8");

  if (path.basename(file) === "index.html" && path.dirname(file) === appDir) {
    indexHtml = html;
    indexHtmlPath = file;
  }

  // (a) The regression this whole guard exists for: content silently hidden behind Suspense
  // and swapped in client-side. `div hidden id="S:0"` is Next's marker for a hydration-deferred
  // segment rendered with `hidden`; `<!--$?-->` is the Suspense boundary's pending-fallback
  // comment. Either one present in a prerendered page means a crawler sees an empty shell.
  if (html.includes('div hidden id="S:0"')) {
    fail(rel, 'no `div hidden id="S:0"` marker', 'found — a Suspense boundary is hiding prerendered content from crawlers (see app/layout.tsx body comment on Suspense placement)');
  }
  const pendingMarkerCount = (html.match(/<!--\$\?-->/g) || []).length;
  if (pendingMarkerCount > 0) {
    fail(rel, 'no `<!--$?-->` pending-Suspense marker', `found ${pendingMarkerCount} occurrence(s) — a Suspense boundary above real content never resolved before the static shell was captured`);
  }

  // (b) Every emitted application/ld+json block must be valid JSON. A parse failure here is
  // invisible to a human skimming JSX but makes the structured data worthless to Google — an
  // unparseable block is silently dropped by every consumer, not just "not indexed."
  const ldRe = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  let ldMatch;
  let ldIndex = 0;
  while ((ldMatch = ldRe.exec(html))) {
    ldIndex++;
    try {
      JSON.parse(ldMatch[1]);
    } catch (err) {
      fail(rel, `application/ld+json block #${ldIndex} parses as JSON`, err.message);
    }
  }

  // (c) Indexable-route metadata completeness. A route is "indexable" unless it explicitly opts
  // out via <meta name="robots" content="...noindex...">, or is Next's own error shell (which is
  // not a route at all — see isFrameworkErrorShell above). This reads the ROBOTS TAG THE PAGE
  // ITSELF SHIPPED, rather than hand-maintaining a list of noindex routes in this script — the
  // two would drift the moment someone adds a new noindex page (account/*, orders/*, (auth)/*,
  // _internal/preview/*, or a conditionally-noindex page like /search or /products) without
  // remembering to update a second list here.
  if (!isFrameworkErrorShell(html)) {
    const robotsContent = /<meta name="robots" content="([^"]*)"/.exec(html)?.[1] ?? "";
    const isNoindex = /noindex/i.test(robotsContent);
    if (!isNoindex) {
      if (!/<title>[^<]+<\/title>/.test(html)) {
        fail(rel, "indexable route has <title>", "missing or empty <title> element");
      }
      if (!/<meta name="description" content="[^"]+"/.test(html)) {
        fail(rel, 'indexable route has <meta name="description">', "missing, or content attribute is empty");
      }
      if (!/<link rel="canonical" href="[^"]+"/.test(html)) {
        fail(rel, 'indexable route has <link rel="canonical">', "missing canonical link");
      }
    }
  }
}

if (!indexHtml) {
  fail("(.next/server/app/index.html)", "index.html exists in the build output", "not found — homepage did not prerender at all");
}

// ---------------------------------------------------------------------------------------------
// 2. Hard-fail, environment-independent asset checks.
// ---------------------------------------------------------------------------------------------
//
// These three files were 404s before this SEO batch and their absence was a top-3 cause of the
// brand entity failing Google's Rich Results validation (no `logo`, no OG share image, no home-
// screen icon). Existence AND correct dimensions are asserted — a wrong-sized replacement is as
// broken for Organization/OG validation as a missing file, just less obviously so.
//
// NOTE: `og-image.jpg` here is a deliberate fallback asset, kept present and correctly sized for
// the pages that explicitly reference it (app/search/page.tsx, app/products/page.tsx's brand
// listing). It is NOT currently the og:image emitted by any prerendered page in this build (those
// all use the default app/opengraph-image.tsx dynamic route) — this existence+dimension check is
// independent of, and does not substitute for, the og:image RESOLUTION check further below, which
// verifies whatever og:image URL a page actually emits, wherever it points.

const REQUIRED_ASSETS = [
  { rel: "logo.png", width: 512, height: 512, kind: "png" },
  { rel: "og-image.jpg", width: 1200, height: 630, kind: "jpeg" },
  { rel: "apple-touch-icon.png", width: 180, height: 180, kind: "png" },
];

function pngSize(buf) {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function jpegSize(buf) {
  let i = 2;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buf[i + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const len = buf.readUInt16BE(i + 2);
    const isSOF =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isSOF) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return null;
}

for (const asset of REQUIRED_ASSETS) {
  const abs = path.join(publicDir, asset.rel);
  const relLabel = `public/${asset.rel}`;
  if (!fs.existsSync(abs)) {
    fail(relLabel, "file exists in public/", "missing — this path is referenced as a brand asset (Organization logo, OG share image, or apple-touch-icon) and 404s for crawlers if absent");
    continue;
  }
  const buf = fs.readFileSync(abs);
  const size = asset.kind === "png" ? pngSize(buf) : jpegSize(buf);
  if (!size) {
    fail(relLabel, `readable as a valid ${asset.kind.toUpperCase()}`, "file exists but its header could not be parsed — it may be corrupt or not actually an image of that format");
  } else if (size.width !== asset.width || size.height !== asset.height) {
    fail(relLabel, `dimensions are ${asset.width}x${asset.height}`, `found ${size.width}x${size.height}`);
  }
}

// Referenced-asset existence: anything the emitted HTML actually points at (apple-touch-icon
// link, and any `logo` URL inside a parsed JSON-LD block) must resolve to a real file under
// public/. This is a second, output-driven pass — independent of the hardcoded list above — so a
// future asset added to OrganizationSchema.tsx or the root layout's icons block is still checked
// even before anyone thinks to add it to REQUIRED_ASSETS.
function siteRelativePath(url) {
  if (!url) return null;
  if (url.startsWith("/")) return url;
  try {
    const u = new URL(url);
    return u.pathname;
  } catch {
    return null;
  }
}

const referencedAssets = new Map(); // path -> Set of files that referenced it

function recordReference(file, url) {
  const p = siteRelativePath(url);
  if (!p) return;
  // Next.js dynamic file-convention routes (opengraph-image, icon, favicon.ico when it's an
  // app/ convention file rather than a public/ one) are generated code, not public/ files, and
  // are already covered by the build succeeding at all. Skip them here to avoid false positives.
  if (p === "/favicon.ico" || p.startsWith("/opengraph-image") || p.startsWith("/icon")) return;
  if (!referencedAssets.has(p)) referencedAssets.set(p, new Set());
  referencedAssets.get(p).add(file);
}

for (const file of htmlFiles) {
  const rel = path.relative(repoRoot, file);
  const html = fs.readFileSync(file, "utf8");

  const appleMatch = /<link rel="apple-touch-icon" href="([^"]+)"/.exec(html);
  if (appleMatch) recordReference(rel, appleMatch[1]);

  const ldRe = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  let ldMatch;
  while ((ldMatch = ldRe.exec(html))) {
    let parsed;
    try {
      parsed = JSON.parse(ldMatch[1]);
    } catch {
      continue; // already reported above
    }
    (function collectLogos(node) {
      if (!node || typeof node !== "object") return;
      if (typeof node.logo === "string") recordReference(rel, node.logo);
      for (const v of Object.values(node)) {
        if (v && typeof v === "object") collectLogos(v);
      }
    })(parsed);
  }
}

for (const [assetPath, files] of referencedAssets) {
  const abs = path.join(publicDir, assetPath.replace(/^\//, ""));
  if (!fs.existsSync(abs)) {
    fail([...files].join(", "), `referenced asset "${assetPath}" exists under public/`, `resolves to ${path.relative(repoRoot, abs)}, which does not exist`);
  }
}

// og:image resolution. This is deliberately NOT a "must be a public/ file" check — Task 5 removed
// the static openGraph.images override specifically so app/opengraph-image.tsx (a dynamic edge
// route, `.next/server/app/opengraph-image/route.js` in the build output, not a file under
// public/) stops being shadowed. A page's og:image is allowed to resolve to EITHER a static file
// under public/ OR a route present in the build output; it is a failure only when it resolves to
// neither. Off-origin URLs (a CDN-hosted image, say) are ignored — nothing in this repo to verify.
const SITE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL || "https://minirueshop.com").replace(/\/+$/, "");

function sameOriginPathname(url) {
  if (!url) return null;
  if (url.startsWith("/")) return url.split(/[?#]/)[0]; // already root-relative; strip query/hash
  try {
    const u = new URL(url);
    const site = new URL(SITE_ORIGIN);
    if (u.origin !== site.origin) return null; // off-origin — nothing to verify
    return u.pathname;
  } catch {
    return null;
  }
}

function routeExistsInBuildOutput(pathname) {
  const segments = pathname.replace(/^\//, "").split("/").filter(Boolean);
  if (segments.length === 0) return fs.existsSync(path.join(appDir, "index.html"));
  const base = path.join(appDir, ...segments);
  if (fs.existsSync(`${base}.html`)) return true;
  if (fs.existsSync(base) && fs.statSync(base).isDirectory()) {
    // A Next.js route-handler output dir (e.g. opengraph-image/route.js) rather than a plain
    // prerendered page — presence of any route.* file means the route built successfully.
    return fs.readdirSync(base).some((entry) => entry.startsWith("route."));
  }
  return false;
}

const ogImageRefs = new Map(); // pathname -> Set of files that referenced it

for (const file of htmlFiles) {
  const rel = path.relative(repoRoot, file);
  const html = fs.readFileSync(file, "utf8");
  const ogMatch = /<meta property="og:image" content="([^"]+)"/.exec(html);
  if (!ogMatch) continue;
  const pathname = sameOriginPathname(ogMatch[1]);
  if (pathname === null) continue; // off-origin or unparseable — nothing local to verify
  if (!ogImageRefs.has(pathname)) ogImageRefs.set(pathname, new Set());
  ogImageRefs.get(pathname).add(rel);
}

for (const [pathname, files] of ogImageRefs) {
  const publicAbs = path.join(publicDir, pathname.replace(/^\//, ""));
  const isPublicFile = fs.existsSync(publicAbs);
  const isRoute = !isPublicFile && routeExistsInBuildOutput(pathname);
  if (!isPublicFile && !isRoute) {
    fail(
      [...files].join(", "),
      `og:image "${pathname}" resolves to a public/ file or a build route`,
      `looked for public/${pathname.replace(/^\//, "")} (not found) and a route at .next/server/app${pathname} (not found either)`,
    );
  }
}

// ---------------------------------------------------------------------------------------------
// 3. Product-link check — conditional, because this sandbox has no reachable backend.
// ---------------------------------------------------------------------------------------------
//
// The brief demands index.html contain at least one `href="/products/` link. That is correct in
// production, where the catalog API is reachable and app/sitemap.ts + the homepage both resolve
// real products. It is NOT achievable in this sandbox: no backend is reachable here, so
// `catalog.listProducts` fails, the homepage <main> genuinely has no products to link to, and
// app/sitemap.ts falls back to its five static entries (logged as ECONNREFUSED during the build
// above). Making this an unconditional hard failure would break every local build for every
// developer without a backend running, and the guard would be disabled within a week — so it is
// hard-failed only when there is positive evidence the build HAD a working backend, or when
// SEO_CHECK_REQUIRE_PRODUCTS=1 is set (CI's job: set this once the build step has a real API to
// talk to). Otherwise a missing product link is a warning, not a build breaker.

const sitemapBodyPath = path.join(appDir, "sitemap.xml.body");
let sitemapUrlCount = null;
if (fs.existsSync(sitemapBodyPath)) {
  const sitemapBody = fs.readFileSync(sitemapBodyPath, "utf8");
  sitemapUrlCount = (sitemapBody.match(/<loc>/g) || []).length;
}

// Five static entries (/, /products, /brands, /collab, /categories) is exactly what
// app/sitemap.ts emits when every catalog/space fetch throws — see its own console.error calls
// during the build. More than five means at least one dynamic (product/category/space) URL made
// it in, which only happens with a reachable backend.
const STATIC_ONLY_SITEMAP_COUNT = 5;
const backendLooksReachable = sitemapUrlCount === null || sitemapUrlCount > STATIC_ONLY_SITEMAP_COUNT;

const productLinkCount = indexHtml ? (indexHtml.match(/href="\/products\//g) || []).length : 0;
const requireProducts = process.env.SEO_CHECK_REQUIRE_PRODUCTS === "1";

if (productLinkCount === 0) {
  const detail = sitemapUrlCount === null
    ? "index.html has zero `href=\"/products/\"` links (sitemap.xml.body not found, so backend-reachability could not be inferred)"
    : `index.html has zero \`href="/products/"\` links, and app/sitemap.ts emitted only ${sitemapUrlCount} URL(s) (the static-only count is ${STATIC_ONLY_SITEMAP_COUNT}) — consistent with no backend being reachable during this build`;

  if (requireProducts || backendLooksReachable) {
    const reachabilityReason = sitemapUrlCount === null
      ? "sitemap.xml.body was not found at all, so backend-reachability could not be inferred — failing closed rather than silently downgrading to a warning"
      : `the sitemap has ${sitemapUrlCount} URLs, more than the static-only count of ${STATIC_ONLY_SITEMAP_COUNT} — the backend looks reachable`;
    fail(
      indexHtmlPath ? path.relative(repoRoot, indexHtmlPath) : ".next/server/app/index.html",
      'index.html contains at least one href="/products/" link',
      requireProducts
        ? `${detail}. SEO_CHECK_REQUIRE_PRODUCTS=1 was set, so this is a hard failure regardless of backend reachability.`
        : `${detail}, and ${reachabilityReason} — so an empty homepage is treated as a real regression, not an environment artifact.`,
    );
  } else {
    warn(
      indexHtmlPath ? path.relative(repoRoot, indexHtmlPath) : ".next/server/app/index.html",
      'index.html contains at least one href="/products/" link',
      `${detail}. Treated as a warning, not a build failure, because this looks like a backend-less local build. Set SEO_CHECK_REQUIRE_PRODUCTS=1 (CI does) to make this a hard failure once a backend is expected to be reachable.`,
    );
  }
}

// ---------------------------------------------------------------------------------------------
// 4. robots.txt content check.
// ---------------------------------------------------------------------------------------------
//
// Reads the emitted robots.txt body the same way it reads index.html — from what the build
// actually produced, not from re-parsing app/robots.ts's source.

const robotsBodyCandidates = [
  path.join(appDir, "robots.txt.body"),
  path.join(appDir, "robots.txt"),
];
const robotsBodyPath = robotsBodyCandidates.find((p) => fs.existsSync(p));
const REQUIRED_DISALLOWS = [
  "/login",
  "/signup",
  "/forgot",
  "/reset-password",
  "/api/",
  "/checkout",
  "/cart",
  "/_internal/preview",
];

if (!robotsBodyPath) {
  fail("robots.txt", "robots.txt emitted by the build", `not found — checked ${robotsBodyCandidates.map((p) => path.relative(repoRoot, p)).join(" and ")}`);
} else {
  const robotsBody = fs.readFileSync(robotsBodyPath, "utf8");
  const disallowed = new Set(
    robotsBody
      .split(/\r?\n/)
      .map((line) => /^disallow:\s*(.+)$/i.exec(line.trim())?.[1]?.trim())
      .filter(Boolean),
  );
  for (const path_ of REQUIRED_DISALLOWS) {
    if (!disallowed.has(path_)) {
      fail(path.relative(repoRoot, robotsBodyPath), `robots.txt disallows "${path_}"`, `not found among emitted Disallow rules: ${[...disallowed].join(", ") || "(none)"}`);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// 5. Report.
// ---------------------------------------------------------------------------------------------

if (warnings.length > 0) {
  console.warn(`\nseo-check: ${warnings.length} warning(s):\n`);
  for (const w of warnings) {
    console.warn(`  [WARN] ${w.file}\n         assertion: ${w.assertion}\n         detail:    ${w.detail}\n`);
  }
}

if (failures.length > 0) {
  console.error(`\nseo-check FAILED — ${failures.length} assertion(s) failed:\n`);
  for (const f of failures) {
    console.error(`  [FAIL] ${f.file}\n         assertion: ${f.assertion}\n         detail:    ${f.detail}\n`);
  }
  process.exit(1);
}

console.log(`\nseo-check: passed. ${htmlFiles.length} .html file(s), ${referencedAssets.size} referenced local asset(s), ${ogImageRefs.size} og:image reference(s), ${REQUIRED_ASSETS.length} required brand asset(s) — all clean.${warnings.length ? ` (${warnings.length} warning(s) above.)` : ""}`);
process.exit(0);
