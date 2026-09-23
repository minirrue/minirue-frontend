import type { ResolvedChrome, ResolvedHome } from '@/lib/api/storefront';

/**
 * The postMessage contract between the dashboard Storefront editor and
 * `/_internal/draft-preview` (#193). The dashboard is coded against these
 * exact strings and shapes — do not rename.
 *
 *   iframe → parent
 *     { type: 'mr-preview:ready' }                     once mounted (targetOrigin '*')
 *     { type: 'mr-preview:height', height: number }    on resize
 *     { type: 'mr-preview:select', target: string }    a previewed block was clicked
 *     { type: 'mr-preview:navigate', href: string }     Interact mode: a link was followed
 *
 *   parent → iframe
 *     { type: 'mr-preview:render', home, chrome, view, page?, productSlug?, highlight? }
 *     { type: 'mr-preview:mode', interactive: boolean } Interact mode on/off (#196)
 *
 * `home`/`chrome` are the backend's `POST /v1/storefront/preview` answer —
 * the same shapes `GET /storefront/home` and `/chrome` return — so the real
 * components render them unchanged.
 */

export const PREVIEW_READY = 'mr-preview:ready';
export const PREVIEW_HEIGHT = 'mr-preview:height';
export const PREVIEW_SELECT = 'mr-preview:select';
export const PREVIEW_RENDER = 'mr-preview:render';
export const PREVIEW_MODE = 'mr-preview:mode';
export const PREVIEW_NAVIGATE = 'mr-preview:navigate';

export type PreviewView = 'home' | 'product' | 'menu' | 'page';

const VIEWS: readonly PreviewView[] = ['home', 'product', 'menu', 'page'];

/** The non-section targets. Anything else a click can select is a home section id. */
export const CHROME_TARGETS = ['announcement', 'navbar', 'footer', 'promises'] as const;
export type ChromeTarget = (typeof CHROME_TARGETS)[number];

export interface PreviewPage {
  slug: string;
  title: string;
  body: string;
}

export interface PreviewRenderMessage {
  type: typeof PREVIEW_RENDER;
  home: ResolvedHome;
  chrome: ResolvedChrome;
  view: PreviewView;
  page?: PreviewPage;
  productSlug?: string;
  highlight?: string;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * The origin check. Exact string equality against the allow-list — no
 * prefix or suffix matching, which is how `https://dashboard.minirueshop.com.evil.test`
 * would get in.
 */
export function isAllowedOrigin(origin: string, allowed: readonly string[]): boolean {
  return allowed.includes(origin);
}

/**
 * Accepts a render message or returns null. Shape-checked just enough that
 * the real components cannot be handed something that throws mid-render
 * (a missing `sections` array, a chrome without its navbar or footer); a
 * malformed message is ignored like a foreign one, and the last good render
 * stays on screen.
 */
export function parseRenderMessage(data: unknown): PreviewRenderMessage | null {
  if (!isObject(data) || data.type !== PREVIEW_RENDER) return null;

  const { home, chrome, view, page, productSlug, highlight } = data;
  if (!isObject(home) || !Array.isArray(home.sections)) return null;
  if (
    !isObject(chrome) ||
    !isObject(chrome.navbar) ||
    !Array.isArray(chrome.navbar.items) ||
    !isObject(chrome.footer) ||
    !isObject(chrome.announcement)
  ) {
    return null;
  }
  if (typeof view !== 'string' || !VIEWS.includes(view as PreviewView)) return null;

  let parsedPage: PreviewPage | undefined;
  if (page !== undefined) {
    if (
      !isObject(page) ||
      typeof page.slug !== 'string' ||
      typeof page.title !== 'string' ||
      typeof page.body !== 'string'
    ) {
      return null;
    }
    parsedPage = { slug: page.slug, title: page.title, body: page.body };
  }
  if (view === 'page' && !parsedPage) return null;

  if (productSlug !== undefined && typeof productSlug !== 'string') return null;
  if (view === 'product' && !productSlug) return null;
  if (highlight !== undefined && typeof highlight !== 'string') return null;

  return {
    type: PREVIEW_RENDER,
    home: home as unknown as ResolvedHome,
    chrome: chrome as unknown as ResolvedChrome,
    view: view as PreviewView,
    ...(parsedPage ? { page: parsedPage } : {}),
    ...(productSlug ? { productSlug } : {}),
    ...(highlight ? { highlight } : {}),
  };
}

/**
 * Interact mode (#196): `true` lets the shop's own handlers run (menus,
 * sheets, carousels, keyboard) instead of every click selecting a block.
 * Returns null for anything that is not a well-formed mode message.
 */
export function parseModeMessage(data: unknown): { interactive: boolean } | null {
  if (!isObject(data) || data.type !== PREVIEW_MODE) return null;
  if (typeof data.interactive !== 'boolean') return null;
  return { interactive: data.interactive };
}
