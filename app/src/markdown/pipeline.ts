// Markdown to HTML for the preview pane.
//
// unified + remark-parse (micromark: CommonMark compliant) + remark-gfm (tables, task lists,
// strikethrough, autolinks, footnotes) + front matter + maths, then rehype with raw HTML
// allowed but sanitised (GitHub's rules: no scripts, no event handlers, no iframes).
// KaTeX and syntax highlighting run after sanitising so their output is kept.
// Every block element gets data-line="<source line>" so the preview can scroll-sync.

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';

export interface RenderOptions {
  /** Turn a relative image / link URL into something the web view can load. */
  resolveUrl?: (url: string) => string;
  /** Block remote (http/https) images. */
  blockRemoteImages?: boolean;
}

const BLOCK_TAGS = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'pre', 'table', 'tr', 'hr', 'div', 'section', 'dl',
]);

/** Front matter is shown as a YAML code block instead of being silently dropped. */
function remarkShowFrontmatter() {
  return (tree: any) => {
    visit(tree, (node: any) => {
      if (node.type === 'yaml' || node.type === 'toml') {
        const lang = node.type;
        node.type = 'code';
        node.lang = lang;
        node.data = { hProperties: { dataFrontmatter: 'true' } };
      }
    });
  };
}

function rehypeSourceLines() {
  return (tree: any) => {
    visit(tree, 'element', (node: any) => {
      if (BLOCK_TAGS.has(node.tagName) && node.position?.start?.line) {
        node.properties = node.properties || {};
        node.properties.dataLine = node.position.start.line;
      }
    });
  };
}

function rehypeUrls(opts: RenderOptions) {
  return () => (tree: any) => {
    visit(tree, 'element', (node: any) => {
      const p = node.properties || {};
      if (node.tagName === 'img' && typeof p.src === 'string') {
        const remote = /^https?:/i.test(p.src);
        if (remote && opts.blockRemoteImages) {
          p.alt = `[remote image blocked] ${p.alt ?? ''}`;
          p.src = '';
        } else if (!remote && !p.src.startsWith('data:') && opts.resolveUrl) p.src = opts.resolveUrl(p.src);
        p.loading = 'lazy';
      }
      if (node.tagName === 'a' && typeof p.href === 'string') {
        p.title = p.title ?? p.href;
      }
    });
  };
}

const schema = {
  ...defaultSchema,
  // Keep GitHub's id prefixing for headings/footnotes but allow our extra attributes.
  attributes: {
    ...defaultSchema.attributes,
    '*': [...(defaultSchema.attributes?.['*'] ?? []), 'dataLine', 'dataFrontmatter', 'className', 'align'],
    code: [...(defaultSchema.attributes?.code ?? []), ['className', /^language-./, 'math-inline', 'math-display']],
    img: [...(defaultSchema.attributes?.img ?? []), 'loading', 'width', 'height', 'align'],
    input: [...(defaultSchema.attributes?.input ?? [])],
  },
  tagNames: [...(defaultSchema.tagNames ?? []), 'mark', 'u', 'abbr', 'figure', 'figcaption', 'center'],
};

function buildProcessor(opts: RenderOptions) {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkFrontmatter, ['yaml', 'toml'])
    .use(remarkShowFrontmatter)
    .use(remarkMath)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSourceLines)
    .use(rehypeSanitize, schema as any)
    .use(rehypeSlug)
    .use(rehypeUrls(opts))
    .use(rehypeKatex, { throwOnError: false, strict: 'ignore' } as any)
    .use(rehypeHighlight, { detect: false, ignoreMissing: true, plainText: ['mermaid', 'text', 'txt'] } as any)
    .use(rehypeStringify);
}

let cached: { key: string; proc: ReturnType<typeof buildProcessor> } | null = null;

export function renderMarkdown(source: string, opts: RenderOptions = {}): string {
  const key = `${opts.blockRemoteImages ? 1 : 0}|${opts.resolveUrl ? opts.resolveUrl('') : ''}`;
  if (!cached || cached.key !== key) cached = { key, proc: buildProcessor(opts) };
  try {
    return String(cached.proc.processSync(source));
  } catch (e) {
    // The parser itself never fails on any input; this only guards plugin bugs.
    const esc = source.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
    return `<div class="md-error">Preview failed: ${String(e)}</div><pre>${esc}</pre>`;
  }
}

/** Markdown-ish file types. */
export function isMarkdownPath(path: string | undefined | null): boolean {
  return !!path && /\.(md|markdown|mdown|mkd|mkdn|mdx)$/i.test(path);
}
