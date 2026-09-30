// Content the Visual view shows but doesn't edit: it keeps the exact source text and writes it
// back unchanged. Anything TipTap can't write back byte-for-byte belongs here, so an edit
// elsewhere in the file never loses or changes it. Double-click a block to edit it in Source view.
import { Node, mergeAttributes } from '@tiptap/core';
import { renderMarkdown } from '../../markdown/pipeline';
import { renderMermaid } from '../../markdown/mermaid';
import { alignedToken } from './align';
import { ownSpan } from './marks';
import { ownHtmlTable } from './tables';
import type { VisualRenderContext } from './render-context';
import type { RenderOptions } from '../../markdown/pipeline';

type BlockKind = 'frontmatter' | 'math' | 'mermaid' | 'footnote' | 'reference' | 'html';
export const LOCKED_LABEL: Record<string, string> = {
  frontmatter: 'Front matter',
  math: 'Maths',
  mermaid: 'Mermaid diagram',
  footnote: 'Footnote',
  reference: 'Link reference',
  html: 'HTML',
  'footnote-ref': 'Footnote',
  image: 'Image',
  link: 'Link',
  entity: 'Character',
  escape: 'Escaped character',
};

const blockRules: { kind: BlockKind; re: RegExp; first?: boolean }[] = [
  { kind: 'frontmatter', re: /^---\n[\s\S]*?\n---[ \t]*(?:\n+|$)/, first: true },
  { kind: 'math', re: /^\$\$\n[\s\S]*?\n\$\$[ \t]*(?:\n+|$)/ },
  { kind: 'mermaid', re: /^```mermaid\n[\s\S]*?\n```[ \t]*(?:\n+|$)/ },
  // Footnote definition, including indented continuation lines and paragraphs.
  { kind: 'footnote', re: /^\[\^[^\]\n]+\]:[^\n]*(?:\n(?:[ \t]*\n)*(?: {2,}|\t)[^\n]*)*(?:\n+|$)/ },
  // Link reference definition: [label]: url "title"
  { kind: 'reference', re: /^ {0,3}\[(?!\^)[^\]\n]+\]:[ \t]*\S[^\n]*(?:\n+|$)/ },
];

const VOID_TAGS = new Set(['br', 'hr', 'img', 'input', 'wbr', 'source', 'col', 'area', 'embed', 'meta', 'link', 'track', 'param', 'base']);

/** End index of the element opening at the start of `src` (nesting-aware), or -1. */
function elementEnd(src: string, tag: string, openLen: number): number {
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
  re.lastIndex = openLen;
  let depth = 1;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return m.index + m[0].length;
  }
  return -1;
}

/** A block that starts with raw HTML: through the matching close tag's line, else up to a blank line. */
function htmlBlock(src: string, lexer: any): string | null {
  if (alignedToken(src, lexer)) return null; // an aligned block Visual edits itself
  if (ownHtmlTable(src)) return null; // a table Visual edits itself (tables.ts)
  const comment = /^<!--[\s\S]*?-->[^\n]*(?:\n+|$)/.exec(src);
  if (comment) return comment[0];
  const open = /^<([a-zA-Z][\w-]*)\b[^>]*>/.exec(src);
  if (!open) return null;
  const tag = open[1].toLowerCase();
  if (tag === 'u' || ownSpan(src)) return null; // inline formatting at the start of a paragraph
  if (!VOID_TAGS.has(tag)) {
    const end = elementEnd(src, tag, open[0].length);
    if (end > 0) {
      const lineEnd = src.indexOf('\n', end);
      const stop = lineEnd < 0 ? src.length : lineEnd;
      if (!src.slice(end, stop).trim()) return src.slice(0, stop) + /^\n*/.exec(src.slice(stop))![0];
    }
  }
  return /^[\s\S]*?(?:\n[ \t]*\n+|$)/.exec(src)![0];
}

/** Inline raw HTML: a whole element (nesting-aware) or a single tag, or a comment. */
function htmlInline(src: string): string | null {
  const comment = /^<!--[\s\S]*?-->/.exec(src);
  if (comment) return comment[0];
  if (/^<\/?u>/.test(src) || ownSpan(src)) return null; // Visual edits these itself
  const close = /^<\/[a-zA-Z][\w-]*\s*>/.exec(src);
  if (close) return close[0];
  const open = /^<([a-zA-Z][\w-]*)\b[^>\n]*>/.exec(src);
  if (!open) return null;
  const tag = open[1].toLowerCase();
  if (VOID_TAGS.has(tag) || open[0].endsWith('/>')) return open[0];
  const end = elementEnd(src, tag, open[0].length);
  return end > 0 ? src.slice(0, end) : open[0];
}

const INLINE_RULES: { kind: string; re: RegExp }[] = [
  { kind: 'math', re: /^\$(?!\s)[^$\n]+?(?<!\s)\$(?!\d)/ },
  { kind: 'footnote-ref', re: /^\[\^[^\]\n]+\](?!:)/ },
  // Images (no image node here), badges (image inside a link), reference links, <url> targets.
  { kind: 'image', re: /^\[!\[[^\]\n]*\](?:\([^)\n]*\)|\[[^\]\n]*\])\](?:\([^)\n]*\)|\[[^\]\n]*\])/ },
  { kind: 'image', re: /^!\[[^\]\n]*\](?:\([^)\n]*\)|\[[^\]\n]*\])/ },
  { kind: 'link', re: /^\[[^\]\n]+\]\[[^\]\n]*\]/ },
  { kind: 'link', re: /^\[[^\]\n]*\]\(<[^>\n]*>[^)\n]*\)/ },
  { kind: 'entity', re: /^&(?:#\d{1,7}|#x[0-9a-f]{1,6}|[a-z][a-z0-9]{1,31});/i },
  { kind: 'escape', re: /^\\[!-/:-@[-`{-~]/ },
];

function renderInto(el: HTMLElement, raw: string, options: RenderOptions = {}) {
  el.innerHTML = renderMarkdown(raw, options); // sanitised by the preview pipeline
  if (!el.textContent?.trim() && !el.querySelector('img, svg, hr, .page-break')) {
    // Renders to nothing on its own (e.g. a footnote or link definition): show the source.
    const pre = document.createElement('pre');
    pre.className = 'locked-source';
    pre.textContent = raw;
    el.replaceChildren(pre);
    return;
  }
  void renderMermaid(el, document.documentElement.classList.contains('dark'));
}

export const LockedBlock = Node.create({
  name: 'lockedBlock',
  addOptions() { return { renderContext: undefined as VisualRenderContext | undefined }; },
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,
  addAttributes() {
    return { raw: { default: '' }, kind: { default: 'html' } };
  },
  parseHTML() {
    return [{ tag: 'div[data-locked]', getAttrs: (el: HTMLElement) => ({ kind: el.dataset.locked, raw: el.dataset.raw ?? el.textContent ?? '' }) }];
  },
  renderHTML({ node, HTMLAttributes }: { node: any; HTMLAttributes: Record<string, any> }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-locked': node.attrs.kind, 'data-raw': node.attrs.raw, class: 'locked-block' }), ['pre', {}, String(node.attrs.raw)]];
  },
  // Show the block rendered (KaTeX, Mermaid, sanitised HTML) rather than as source.
  addNodeView() {
    const context = this.options.renderContext as VisualRenderContext | undefined;
    return ({ node }: { node: any }) => {
      const dom = document.createElement('div');
      const label = LOCKED_LABEL[node.attrs.kind] ?? 'Locked';
      dom.className = 'locked-block';
      dom.dataset.locked = node.attrs.kind;
      dom.dataset.label = label;
      dom.title = `${label}: double-click to edit in Source view`;
      dom.contentEditable = 'false';
      const body = document.createElement('div');
      body.className = 'locked-render';
      const render = () => renderInto(body, String(node.attrs.raw), context?.options());
      render();
      const unsubscribe = context?.subscribe(render);
      dom.append(body);
      return { dom, ignoreMutation: () => true, destroy: unsubscribe };
    };
  },
  markdownTokenizer: {
    name: 'lockedBlock',
    level: 'block',
    // Only a real line start may interrupt a paragraph (marked calls this with the paragraph's
    // text minus its first character, so index 0 is never a line start).
    start: (src: string) => {
      const m = /\n(?=---\n|\$\$\n|```mermaid\n|<[a-zA-Z!])/.exec(src);
      return m ? m.index + 1 : -1;
    },
    tokenize: (src: string, tokens: unknown[], lexer: any) => {
      for (const r of blockRules) {
        if (r.first && tokens.length > 0) continue;
        const m = r.re.exec(src);
        if (m) return { type: 'lockedBlock', raw: m[0], kind: r.kind };
      }
      const html = htmlBlock(src, lexer);
      if (html) return { type: 'lockedBlock', raw: html, kind: 'html' };
      return undefined;
    },
  },
  parseMarkdown: (token: any, h: any) => h.createNode('lockedBlock', { raw: String(token.raw).replace(/\s+$/, ''), kind: token.kind }),
  renderMarkdown: (node: any) => String(node.attrs?.raw ?? ''),
} as any);

export const LockedInline = Node.create({
  name: 'lockedInline',
  addOptions() { return { renderContext: undefined as VisualRenderContext | undefined }; },
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
  addNodeView() {
    const context = this.options.renderContext as VisualRenderContext | undefined;
    return ({ node }: { node: any }) => {
      const dom = document.createElement('span');
      dom.className = 'locked-inline';
      dom.dataset.locked = node.attrs.kind;
      dom.contentEditable = 'false';
      dom.title = `${LOCKED_LABEL[node.attrs.kind] ?? 'Locked'}: double-click to edit in Source view`;
      const render = () => {
        // A Markdown image renders inside a paragraph; unwrap it for an inline node view.
        const body = document.createElement('div');
        renderInto(body, String(node.attrs.raw), context?.options());
        const p = body.childElementCount === 1 && body.firstElementChild?.tagName === 'P' ? body.firstElementChild : body;
        dom.replaceChildren(...Array.from(p.childNodes));
      };
      render();
      const unsubscribe = context?.subscribe(render);
      return { dom, ignoreMutation: () => true, destroy: unsubscribe };
    };
  },
  markdownTokenizer: {
    name: 'lockedInline',
    level: 'inline',
    start: (src: string) => src.search(/\$|\[|!\[|<[a-zA-Z!/]|&|\\/),
    tokenize: (src: string) => {
      for (const r of INLINE_RULES) {
        const m = r.re.exec(src);
        if (m) return { type: 'lockedInline', raw: m[0], kind: r.kind };
      }
      const html = htmlInline(src);
      return html ? { type: 'lockedInline', raw: html, kind: 'html' } : undefined;
    },
  },
  parseMarkdown: (token: any, h: any) => h.createNode('lockedInline', { raw: token.raw, kind: token.kind }),
  renderMarkdown: (node: any) => String(node.attrs?.raw ?? ''),
} as any);

export const lockedExtensions = [LockedBlock, LockedInline];
