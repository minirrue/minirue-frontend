import { llmsTxtResponse } from '@/lib/seo/llms-response';

/** /llms-full.txt (#150): /llms.txt plus each product's plain-text description. */
export const dynamic = 'force-dynamic';

export function GET(): Promise<Response> {
  return llmsTxtResponse({ full: true });
}
