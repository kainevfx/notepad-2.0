// Paragraph / heading alignment. Markdown has no syntax for it, so an aligned block is written
// the way GitHub renders it, with the Markdown kept inside:
//
//   <div align="center">
//
//   Some **centred** text
//
//   </div>
//
// Left alignment writes plain Markdown. Older single-line <p align="…">…</p> / <hN align="…">
// blocks still load.
import { Extension } from '@tiptap/core';
import TextAlign from '@tiptap/extension-text-align';
import Paragraph from '@tiptap/extension-paragraph';
import Heading from '@tiptap/extension-heading';

const DIV_ALIGNED = /^<div align="(left|center|right|justify)">[ \t]*\n[ \t]*\n([\s\S]*?)\n[ \t]*\n<\/div>[ \t]*(?:\n+|$)/;
const TAG_ALIGNED = /^<(p|h([1-6])) align="(left|center|right|justify)">([\s\S]*?)<\/\1>[ \t]*(?:\n+|$)/;

export const AlignedBlockMarkdown = Extension.create({
  name: 'alignedBlock',
  markdownTokenizer: {
    name: 'alignedBlock',
    level: 'block',
    start: (src: string) => src.search(/<(?:div|p|h[1-6]) align="/),
    tokenize: (src: string, _tokens: unknown, lexer: any) => {
      const d = DIV_ALIGNED.exec(src);
      if (d) return { type: 'alignedBlock', raw: d[0], align: d[1], tokens: lexer.blockTokens(d[2]), block: true };
      const t = TAG_ALIGNED.exec(src);
      if (t) return { type: 'alignedBlock', raw: t[0], align: t[3], level: t[2] ? Number(t[2]) : 0, tokens: lexer.inlineTokens(t[4]), block: false };
      return undefined;
    },
  },
  parseMarkdown: (token: any, h: any) => {
    if (!token.block) {
      return h.createNode(
        token.level ? 'heading' : 'paragraph',
        { textAlign: token.align, ...(token.level ? { level: token.level } : {}) },
        h.parseInline(token.tokens || []),
      );
    }
    return h.parseChildren(token.tokens || []).map((n: any) =>
      n.type === 'paragraph' || n.type === 'heading' ? { ...n, attrs: { ...(n.attrs ?? {}), textAlign: token.align } } : n,
    );
  },
} as any);

function aligned(node: any): string | null {
  const a = node?.attrs?.textAlign;
  return a && a !== 'left' ? a : null;
}

const wrap = (a: string, md: string) => `<div align="${a}">\n\n${md}\n\n</div>`;

export const AlignedParagraph = Paragraph.extend({
  renderMarkdown(node: any, h: any, ctx: any) {
    const md = (Paragraph.config as any).renderMarkdown(node, h, ctx);
    const a = aligned(node);
    return a && md ? wrap(a, md) : md;
  },
} as any);

export const AlignedHeading = Heading.extend({
  renderMarkdown(node: any, h: any, ctx: any) {
    const md = (Heading.config as any).renderMarkdown(node, h, ctx);
    const a = aligned(node);
    return a ? wrap(a, md) : md;
  },
} as any);

export const alignExtensions = [
  AlignedParagraph,
  AlignedHeading,
  TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right', 'justify'] }),
  AlignedBlockMarkdown,
];
