// Content the Visual view shows but doesn't edit: it keeps the exact source text and writes it
// back unchanged. Double-click one to edit it in Source view.
import { Node, mergeAttributes } from '@tiptap/core';

type BlockKind = 'frontmatter' | 'math' | 'mermaid' | 'footnote' | 'html';
export const LOCKED_LABEL: Record<string, string> = {
  frontmatter: 'Front matter',
  math: 'Maths',
  mermaid: 'Mermaid diagram',
  footnote: 'Footnote',
  html: 'HTML',
  'footnote-ref': 'Footnote',
};

const blockRules: { kind: BlockKind; re: RegExp; first?: boolean }[] = [
  { kind: 'frontmatter', re: /^---\n[\s\S]*?\n---[ \t]*(?:\n+|$)/, first: true },
  { kind: 'math', re: /^\$\$\n[\s\S]*?\n\$\$[ \t]*(?:\n+|$)/ },
  { kind: 'mermaid', re: /^```mermaid\n[\s\S]*?\n```[ \t]*(?:\n+|$)/ },
  { kind: 'footnote', re: /^\[\^[^\]\n]+\]:[^\n]*(?:\n(?: {2,}|\t)[^\n]*)*(?:\n+|$)/ },
];

// Tags the Visual view edits itself (see marks.ts / align.ts); every other tag stays raw.
const OWN_TAG = /^<\/?(?:u>|span style=|(?:p|h[1-6]) align=")/;
const VOID_TAGS = new Set(['br', 'hr', 'img', 'input', 'wbr', 'source', 'col', 'area', 'embed', 'meta', 'link', 'track', 'param', 'base']);

/** A block that starts with raw HTML: through the matching close tag's line, else up to a blank line. */
function htmlBlock(src: string): string | null {
  if (OWN_TAG.test(src)) return null;
  const comment = /^<!--[\s\S]*?-->[^\n]*(?:\n+|$)/.exec(src);
  if (comment) return comment[0];
  const open = /^<([a-zA-Z][\w-]*)\b[^>]*>/.exec(src);
  if (!open) return null;
  const tag = open[1].toLowerCase();
  if (!VOID_TAGS.has(tag)) {
    const close = new RegExp(`</${tag}\\s*>`, 'i').exec(src.slice(open[0].length));
    if (close) {
      const end = open[0].length + close.index + close[0].length;
      const lineEnd = src.indexOf('\n', end);
      const rest = lineEnd < 0 ? src.slice(end) : src.slice(end, lineEnd);
      if (!rest.trim()) {
        const m = /^\n*/.exec(src.slice(lineEnd < 0 ? src.length : lineEnd))!;
        return src.slice(0, lineEnd < 0 ? src.length : lineEnd) + m[0];
      }
    }
  }
  const para = /^[\s\S]*?(?:\n[ \t]*\n+|$)/.exec(src)!;
  return para[0];
}

/** An inline HTML tag (with its content when it has a close tag), or a comment. */
function htmlInline(src: string): string | null {
  if (OWN_TAG.test(src)) return null;
  const comment = /^<!--[\s\S]*?-->/.exec(src);
  if (comment) return comment[0];
  const close = /^<\/[a-zA-Z][\w-]*\s*>/.exec(src);
  if (close) return close[0];
  const open = /^<([a-zA-Z][\w-]*)\b[^>\n]*>/.exec(src);
  if (!open) return null;
  const tag = open[1].toLowerCase();
  if (VOID_TAGS.has(tag) || open[0].endsWith('/>')) return open[0];
  const end = new RegExp(`</${tag}\\s*>`, 'i').exec(src.slice(open[0].length));
  return end ? src.slice(0, open[0].length + end.index + end[0].length) : open[0];
}

export const LockedBlock = Node.create({
  name: 'lockedBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,
  addAttributes() {
    return { raw: { default: '' }, kind: { default: 'html' } };
  },
  parseHTML() {
    return [{ tag: 'div[data-locked]', getAttrs: (el: HTMLElement) => ({ kind: el.dataset.locked, raw: el.textContent ?? '' }) }];
  },
  renderHTML({ node, HTMLAttributes }: { node: any; HTMLAttributes: Record<string, any> }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-locked': node.attrs.kind,
        'data-label': LOCKED_LABEL[node.attrs.kind] ?? 'Locked',
        class: 'locked-block',
        title: `${LOCKED_LABEL[node.attrs.kind] ?? 'Locked'}: double-click to edit in Source view`,
      }),
      ['pre', {}, String(node.attrs.raw)],
    ];
  },
  markdownTokenizer: {
    name: 'lockedBlock',
    level: 'block',
    start: (src: string) => src.search(/^(?:---\n|\$\$\n|```mermaid\n|\[\^|<[a-zA-Z!])/m),
    tokenize: (src: string, tokens: unknown[]) => {
      for (const r of blockRules) {
        if (r.first && tokens.length > 0) continue;
        const m = r.re.exec(src);
        if (m) return { type: 'lockedBlock', raw: m[0], kind: r.kind };
      }
      const html = htmlBlock(src);
      if (html) return { type: 'lockedBlock', raw: html, kind: 'html' };
      return undefined;
    },
  },
  parseMarkdown: (token: any, h: any) => h.createNode('lockedBlock', { raw: String(token.raw).replace(/\s+$/, ''), kind: token.kind }),
  renderMarkdown: (node: any) => String(node.attrs?.raw ?? ''),
} as any);

export const LockedInline = Node.create({
  name: 'lockedInline',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return { raw: { default: '' }, kind: { default: 'html' } };
  },
  parseHTML() {
    return [{ tag: 'span[data-locked]', getAttrs: (el: HTMLElement) => ({ kind: el.dataset.locked, raw: el.textContent ?? '' }) }];
  },
  renderHTML({ node, HTMLAttributes }: { node: any; HTMLAttributes: Record<string, any> }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-locked': node.attrs.kind,
        class: 'locked-inline',
        title: `${LOCKED_LABEL[node.attrs.kind] ?? 'Locked'}: double-click to edit in Source view`,
      }),
      String(node.attrs.raw),
    ];
  },
  markdownTokenizer: {
    name: 'lockedInline',
    level: 'inline',
    start: (src: string) => src.search(/\$|\[\^|<[a-zA-Z!/]/),
    tokenize: (src: string) => {
      const m = /^\$(?!\s)[^$\n]+?(?<!\s)\$(?!\d)/.exec(src) || /^\[\^[^\]\n]+\](?!:)/.exec(src);
      if (m) return { type: 'lockedInline', raw: m[0], kind: m[0][0] === '$' ? 'math' : 'footnote-ref' };
      const html = htmlInline(src);
      return html ? { type: 'lockedInline', raw: html, kind: 'html' } : undefined;
    },
  },
  parseMarkdown: (token: any, h: any) => h.createNode('lockedInline', { raw: token.raw, kind: token.kind }),
  renderMarkdown: (node: any) => String(node.attrs?.raw ?? ''),
} as any);

export const lockedExtensions = [LockedBlock, LockedInline];
