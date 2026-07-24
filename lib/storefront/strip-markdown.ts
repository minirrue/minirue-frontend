/** Strips Markdown syntax down to plain text for a meta description. */
export function stripMarkdown(body: string): string {
  return body
    .replace(/\r\n/g, '\n')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^-\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}
