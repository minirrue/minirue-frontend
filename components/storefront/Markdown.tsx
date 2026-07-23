/**
 * Small, dependency-free Markdown-subset renderer for admin-authored "constant pages"
 * (Terms, Privacy, Shipping, Returns, …). Supports headings (#, ##, ###), paragraphs,
 * **bold**, *italic*, links [text](url), unordered lists (- item), and line breaks.
 *
 * Everything else is treated as literal text — React escapes it automatically since we never
 * use `dangerouslySetInnerHTML`. That means raw HTML in the body renders as visible text
 * instead of being injected as markup, which is correct hygiene for content shown to the
 * public even though the admin authoring it is trusted.
 */

import React from 'react';

/** Only allow http(s) and relative/anchor URLs — never `javascript:` or other schemes. */
function isSafeHref(href: string): boolean {
  const trimmed = href.trim();
  if (trimmed.startsWith('/') || trimmed.startsWith('#') || trimmed.startsWith('.')) {
    return true;
  }
  return /^https?:\/\//i.test(trimmed);
}

const LINK_RE = /\[([^\]]*)\]\(([^)]*)\)/g;
const BOLD_RE = /\*\*([^*]+)\*\*/g;
const ITALIC_RE = /\*([^*]+)\*/g;

/** Parses inline markdown (bold, italic, links) within a single line of text. */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let idx = 0;

  // Tokenize by scanning for links first (they take priority), then bold/italic within
  // the remaining plain segments.
  const linkMatches: Array<{ start: number; end: number; text: string; href: string }> = [];
  LINK_RE.lastIndex = 0;
  while ((match = LINK_RE.exec(text)) !== null) {
    linkMatches.push({
      start: match.index,
      end: match.index + match[0].length,
      text: match[1],
      href: match[2],
    });
  }

  function renderPlainSegment(segment: string, prefix: string): React.ReactNode[] {
    const out: React.ReactNode[] = [];
    let cursor = 0;
    let i = 0;

    // Combine bold/italic scanning by iterating over bold matches, then italics inside gaps.
    const boldMatches: Array<{ start: number; end: number; content: string }> = [];
    BOLD_RE.lastIndex = 0;
    let bm: RegExpExecArray | null;
    while ((bm = BOLD_RE.exec(segment)) !== null) {
      boldMatches.push({ start: bm.index, end: bm.index + bm[0].length, content: bm[1] });
    }

    function renderItalics(plain: string, prefix2: string): React.ReactNode[] {
      const res: React.ReactNode[] = [];
      let c = 0;
      let j = 0;
      ITALIC_RE.lastIndex = 0;
      let im: RegExpExecArray | null;
      while ((im = ITALIC_RE.exec(plain)) !== null) {
        if (im.index > c) {
          res.push(plain.slice(c, im.index));
        }
        res.push(<em key={`${prefix2}-i-${j++}`}>{im[1]}</em>);
        c = im.index + im[0].length;
      }
      if (c < plain.length) {
        res.push(plain.slice(c));
      }
      return res;
    }

    for (const b of boldMatches) {
      if (b.start > cursor) {
        out.push(...renderItalics(segment.slice(cursor, b.start), `${prefix}-p${i}`));
      }
      out.push(<strong key={`${prefix}-b-${i}`}>{b.content}</strong>);
      cursor = b.end;
      i++;
    }
    if (cursor < segment.length) {
      out.push(...renderItalics(segment.slice(cursor), `${prefix}-p${i}`));
    }
    return out;
  }

  for (const lm of linkMatches) {
    if (lm.start > lastIndex) {
      nodes.push(...renderPlainSegment(text.slice(lastIndex, lm.start), `${keyPrefix}-s${idx}`));
    }
    if (isSafeHref(lm.href)) {
      nodes.push(
        <a
          key={`${keyPrefix}-a${idx}`}
          href={lm.href}
          target="_blank"
          rel="noopener noreferrer"
        >
          {lm.text}
        </a>,
      );
    } else {
      // Unsafe scheme (e.g. javascript:) — render as plain text, no href at all.
      nodes.push(lm.text);
    }
    lastIndex = lm.end;
    idx++;
  }
  if (lastIndex < text.length) {
    nodes.push(...renderPlainSegment(text.slice(lastIndex), `${keyPrefix}-tail`));
  }

  return nodes;
}

export default function Markdown({ body }: { body: string }) {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let paragraphBuf: string[] = [];
  let listBuf: string[] = [];
  let blockKey = 0;

  function flushParagraph() {
    if (paragraphBuf.length === 0) return;
    const key = `p-${blockKey++}`;
    blocks.push(<p key={key}>{renderInline(paragraphBuf.join(' '), key)}</p>);
    paragraphBuf = [];
  }

  function flushList() {
    if (listBuf.length === 0) return;
    const key = `ul-${blockKey++}`;
    blocks.push(
      <ul key={key}>
        {listBuf.map((item, i) => (
          <li key={`${key}-li-${i}`}>{renderInline(item, `${key}-li-${i}`)}</li>
        ))}
      </ul>,
    );
    listBuf = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    const listItem = /^-\s+(.*)$/.exec(line);

    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      const key = `h-${blockKey++}`;
      const content = renderInline(heading[2], key);
      if (level === 1) blocks.push(<h1 key={key}>{content}</h1>);
      else if (level === 2) blocks.push(<h2 key={key}>{content}</h2>);
      else blocks.push(<h3 key={key}>{content}</h3>);
      continue;
    }

    if (listItem) {
      flushParagraph();
      listBuf.push(listItem[1]);
      continue;
    }

    if (line.trim() === '') {
      flushParagraph();
      flushList();
      continue;
    }

    flushList();
    paragraphBuf.push(line.trim());
  }
  flushParagraph();
  flushList();

  return <div className="mr-markdown">{blocks}</div>;
}
