// Formatting Markdown has no syntax for, stored as small HTML tags inside the .md:
//   underline            -> <u>…</u>
//   colour / size / weight -> <span style="color:…;font-size:…;font-weight:…">…</span>
import { Extension } from '@tiptap/core';
import Underline from '@tiptap/extension-underline';
import { TextStyle, Color, FontSize } from '@tiptap/extension-text-style';

export const HtmlUnderline = Underline.extend({
  markdownTokenizer: {
    name: 'underline',
    level: 'inline',
    start: (src: string) => src.indexOf('<u>'),
    tokenize: (src: string, _tokens: unknown, lexer: any) => {
      const m = /^<u>([\s\S]*?)<\/u>/.exec(src);
      return m ? { type: 'underline', raw: m[0], text: m[1], tokens: lexer.inlineTokens(m[1]) } : undefined;
    },
  },
  parseMarkdown: (token: any, h: any) => h.applyMark('underline', h.parseInline(token.tokens || [])),
  renderMarkdown: (node: any, h: any) => `<u>${h.renderChildren(node)}</u>`,
} as any);

/** font-weight as an attribute of the textStyle mark (Light / Semibold …). */
export const FontWeight = Extension.create({
  name: 'fontWeight',
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontWeight: {
            default: null,
            parseHTML: (el: HTMLElement) => el.style.fontWeight || null,
            renderHTML: (a: Record<string, any>) => (a.fontWeight ? { style: `font-weight:${a.fontWeight}` } : {}),
          },
        },
      },
    ];
  },
});

export function styleOf(attrs: Record<string, any> | undefined): string {
  const parts: string[] = [];
  if (attrs?.color) parts.push(`color:${attrs.color}`);
  if (attrs?.fontSize) parts.push(`font-size:${attrs.fontSize}`);
  if (attrs?.fontWeight) parts.push(`font-weight:${attrs.fontWeight}`);
  return parts.join(';');
}

export function parseStyle(s: string): Record<string, string> {
  const a: Record<string, string> = {};
  for (const decl of s.split(';')) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    const k = decl.slice(0, i).trim().toLowerCase();
    const v = decl.slice(i + 1).trim();
    if (k === 'color') a.color = v;
    if (k === 'font-size') a.fontSize = v;
    if (k === 'font-weight') a.fontWeight = v;
  }
  return a;
}

const OWN_SPAN = /^<span style="([^"]*)">([\s\S]*?)<\/span>/;
const OWN_PROPS = new Set(['color', 'font-size', 'font-weight']);

/** A <span style="…"> the toolbar wrote: only colour / size / weight, not nested. Others stay raw. */
export function ownSpan(src: string): RegExpExecArray | null {
  const m = OWN_SPAN.exec(src);
  if (!m || m[2].includes('<span')) return null;
  const decls = m[1].split(';').map((d) => d.trim()).filter(Boolean);
  if (!decls.length || !decls.every((d) => OWN_PROPS.has(d.slice(0, d.indexOf(':')).trim().toLowerCase()))) return null;
  return m;
}

export const HtmlTextStyle = TextStyle.extend({
  markdownTokenizer: {
    name: 'textStyle',
    level: 'inline',
    start: (src: string) => src.indexOf('<span style='),
    tokenize: (src: string, _tokens: unknown, lexer: any) => {
      const m = ownSpan(src);
      return m ? { type: 'textStyle', raw: m[0], style: m[1], tokens: lexer.inlineTokens(m[2]) } : undefined;
    },
  },
  parseMarkdown: (token: any, h: any) => h.applyMark('textStyle', h.parseInline(token.tokens || []), parseStyle(token.style || '')),
  renderMarkdown: (node: any, h: any) => {
    const content = h.renderChildren(node);
    const style = styleOf(node.attrs);
    return style ? `<span style="${style}">${content}</span>` : content;
  },
} as any);

export const markExtensions = [HtmlUnderline, HtmlTextStyle, Color, FontSize, FontWeight];
