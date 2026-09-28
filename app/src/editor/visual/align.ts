// Paragraph / heading alignment, stored as <p align="center">…</p> or <h2 align="right">…</h2>.
// Left alignment writes plain Markdown.
import { Extension } from '@tiptap/core';
import TextAlign from '@tiptap/extension-text-align';
import Paragraph from '@tiptap/extension-paragraph';
import Heading from '@tiptap/extension-heading';

const ALIGNED = /^<(p|h([1-6])) align="(left|center|right|justify)">([\s\S]*?)<\/\1>[ \t]*(?:\n+|$)/;

export const AlignedBlockMarkdown = Extension.create({
  name: 'alignedBlock',
  markdownTokenizer: {
    name: 'alignedBlock',
    level: 'block',
    start: (src: string) => src.search(/<(p|h[1-6]) align="/),
    tokenize: (src: string, _tokens: unknown, lexer: any) => {
      const m = ALIGNED.exec(src);
      return m ? { type: 'alignedBlock', raw: m[0], level: m[2] ? Number(m[2]) : 0, align: m[3], tokens: lexer.inlineTokens(m[4]) } : undefined;
    },
  },
  parseMarkdown: (token: any, h: any) =>
    h.createNode(
      token.level ? 'heading' : 'paragraph',
      { textAlign: token.align, ...(token.level ? { level: token.level } : {}) },
      h.parseInline(token.tokens || []),
    ),
} as any);

function aligned(node: any): string | null {
  const a = node?.attrs?.textAlign;
  return a && a !== 'left' ? a : null;
}

export const AlignedParagraph = Paragraph.extend({
  renderMarkdown(node: any, h: any, ctx: any) {
    const a = aligned(node);
    if (!a) return (Paragraph.config as any).renderMarkdown(node, h, ctx);
    return `<p align="${a}">${h.renderChildren(node.content || [])}</p>`;
  },
} as any);

export const AlignedHeading = Heading.extend({
  renderMarkdown(node: any, h: any, ctx: any) {
    const a = aligned(node);
    if (!a) return (Heading.config as any).renderMarkdown(node, h, ctx);
    const tag = `h${node.attrs.level}`;
    return `<${tag} align="${a}">${h.renderChildren(node.content || [])}</${tag}>`;
  },
} as any);

export const alignExtensions = [
  AlignedParagraph,
  AlignedHeading,
  TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right', 'justify'] }),
  AlignedBlockMarkdown,
];
