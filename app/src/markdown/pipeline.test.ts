import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './pipeline';

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
