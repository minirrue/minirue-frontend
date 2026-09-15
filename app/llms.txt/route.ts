import { llmsTxtResponse } from '@/lib/seo/llms-response';

/**
 * /llms.txt (#150): the shop and every published product, for AI assistants.
 *
 * Rendered per request and cached at the CDN for about an hour (see
 * llmsTxtResponse). Not prerendered: a build with no reachable catalog would
 * otherwise bake an empty product list into the deploy.
 */
export const dynamic = 'force-dynamic';

export function GET(): Promise<Response> {
  return llmsTxtResponse({ full: false });
}
