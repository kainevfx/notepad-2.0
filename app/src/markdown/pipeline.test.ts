import { describe, expect, it } from 'vitest';
import { renderMarkdown, cleanStyle } from './pipeline';

describe('markdown pipeline', () => {
  it('renders bold inside a heading (the mockup bug)', () => {
    const html = renderMarkdown('## **Business Strategy** notes');
    expect(html).toContain('<strong>Business Strategy</strong>');
    expect(html).not.toContain('**');
  });
  it('GFM tables with alignment', () => {
    const html = renderMarkdown('| a | b |\n|:--|--:|\n| 1 | 2 |');
    expect(html).toContain('<table');
    expect(html).toMatch(/<td[^>]*align="right"[^>]*>2<\/td>|<td[^>]*style="text-align:\s*right/);
  });
  it('task lists, strikethrough, autolinks', () => {
    const html = renderMarkdown('- [x] done\n- [ ] todo\n\n~~gone~~ www.example.com');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('<del>gone</del>');
    expect(html).toContain('href="http://www.example.com"');
  });
  it('footnotes', () => {
    const html = renderMarkdown('Text[^1]\n\n[^1]: The note.');
    expect(html).toContain('The note.');
    expect(html).toMatch(/footnote/);
  });
  it('front matter shows as yaml instead of a stray hr + text', () => {
    const html = renderMarkdown('---\ntitle: Hi\n---\n\n# Body');
    expect(html).toContain('data-frontmatter');
    expect(html.replace(/<[^>]+>/g, '')).toContain('title: Hi');
    expect(html).not.toContain('<hr');
  });
  it('maths via KaTeX', () => {
    const html = renderMarkdown('Inline $a^2$ and\n\n$$\n\\int x\\,dx\n$$');
    expect(html).toContain('katex');
  });
  it('code highlighting keeps language classes', () => {
    const html = renderMarkdown('```js\nconst a = 1;\n```');
    expect(html).toContain('hljs');
    expect(html).toContain('language-js');
  });
  it('mermaid blocks are left for the client renderer', () => {
    const html = renderMarkdown('```mermaid\ngraph TD; A-->B\n```');
    expect(html).toContain('language-mermaid');
  });
  it('raw HTML is allowed but scripts and handlers are stripped', () => {
    const html = renderMarkdown('<details><summary>More</summary>hidden</details>\n\n<img src="x.png" onerror="alert(1)"><script>alert(2)</script>');
    expect(html).toContain('<details>');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('<script');
  });
  it('javascript: links are removed', () => {
    const html = renderMarkdown('[x](javascript:alert(1))');
    expect(html).not.toContain('javascript:');
  });
  it('tags block elements with their source line', () => {
    const html = renderMarkdown('# One\n\npara\n\n- item');
    expect(html).toContain('data-line="1"');
    expect(html).toContain('data-line="3"');
    expect(html).toContain('data-line="5"');
  });
  it('resolves relative images', () => {
    const html = renderMarkdown('![a](img/p.png)', { resolveUrl: (u) => 'asset://base/' + u });
    expect(html).toContain('src="asset://base/img/p.png"');
  });
  it('never throws on hostile input', () => {
    const junk = '*'.repeat(5000) + '[' .repeat(3000) + '`'.repeat(2000) + '|'.repeat(1000);
    expect(() => renderMarkdown(junk)).not.toThrow();
  });
  it('setext headings, nested lists, blockquotes, hard breaks', () => {
    const html = renderMarkdown('Title\n=====\n\n> quote\n> - a\n>   - b\n\nline  \nbreak');
    expect(html).toContain('<h1');
    expect(html).toContain('<blockquote');
    expect(html).toContain('<br>');
  });
});

describe('inline style allow-list', () => {
  it('keeps colour, size and weight on span', () => {
    const html = renderMarkdown('a <span style="color:#ff0000; font-size:18px; font-weight:300">b</span>');
    expect(html).toContain('style="color:#ff0000;font-size:18px;font-weight:300"');
  });
  it('drops dangerous properties', () => {
    expect(cleanStyle('position:fixed;top:0;color:red')).toBe('color:red');
    expect(cleanStyle('background:url(http://x)')).toBeNull();
    expect(cleanStyle('color:expression(alert(1))')).toBeNull();
    expect(cleanStyle('font-size:9999px')).toBeNull();
    expect(cleanStyle('font-size:200px')).toBeNull();
  });
  it('strips a disallowed style from a span entirely', () => {
    expect(renderMarkdown('<span style="position:fixed;inset:0">x</span>')).not.toContain('style=');
  });
  it('does not allow style on other tags', () => {
    expect(renderMarkdown('<div style="color:red">x</div>')).not.toContain('style=');
  });
  it('keeps align on paragraphs and headings', () => {
    expect(renderMarkdown('<p align="center">x</p>')).toContain('align="center"');
    expect(renderMarkdown('<h2 align="right">x</h2>')).toContain('align="right"');
  });
  it('keeps underline', () => expect(renderMarkdown('<u>x</u>')).toContain('<u>x</u>'));
  it('renders Markdown inside an aligned div', () => {
    const html = renderMarkdown('<div align="center">\n\nmid **bold**\n\n</div>');
    expect(html).toContain('align="center"');
    expect(html).toContain('<strong>bold</strong>');
  });
});

describe('table sizes in the preview', () => {
  const html = '<table>\n<colgroup><col style="width:120px"><col></colgroup>\n<tr style="height:40px"><td>\n\n**x**\n\n</td><td>\n\ny\n\n</td></tr>\n</table>';
  it('keeps column widths and row heights', () => {
    const out = renderMarkdown(html);
    expect(out).toContain('<col style="width:120px">');
    expect(out).toContain('style="height:40px"');
  });
  it('renders Markdown inside cells', () => expect(renderMarkdown(html)).toContain('<strong>x</strong>'));
  it('drops anything else in a table style', () => {
    expect(renderMarkdown('<table><tr style="position:fixed;height:40px"><td>a</td></tr></table>')).toContain('style="height:40px"');
    expect(renderMarkdown('<table><tr><td style="background:url(x)">a</td></tr></table>')).not.toContain('style=');
  });
});

describe('review fixes: images with drive paths', () => {
  it('a drive-letter image is resolved before sanitising, so it keeps its src', () => {
    const html = renderMarkdown('![a](C:/p/a.png)', { resolveUrl: (u) => `http://asset.localhost/${encodeURIComponent(u)}` });
    expect(html).toContain('src="http://asset.localhost/');
  });
});

import { sanitizeHtml } from './pipeline';
describe('sanitizeHtml (Word documents)', () => {
  it('keeps structure, drops scripts and handlers, keeps embedded images', () => {
    const out = sanitizeHtml('<h1 onclick="x()">T</h1><script>alert(1)</script><p><strong>b</strong></p><img src="data:image/png;base64,AAAA"><table><tr><td>c</td></tr></table>');
    expect(out).toContain('<h1>T</h1>');
    expect(out).toContain('<strong>b</strong>');
    expect(out).not.toContain('script');
    expect(out).not.toContain('onclick');
    expect(out).toContain('data:image/png;base64,AAAA');
    expect(out).toContain('<td>c</td>');
  });
  it('javascript: links are removed', () => expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).not.toContain('javascript'));
});
