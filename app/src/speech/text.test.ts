// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { readableText, speechChunks } from './text';
it('speaks Markdown, collapsed prose and tables without raw markup, code or link URLs', () => {
  const source = '# Heading\n\nHello **world**. [Open](https://example.com)\n\n```js\nsecret()\n```\n\n<details><summary>More</summary><p>Hidden prose.</p></details>\n\n| Name | Total |\n|---|---|\n| Foo | 20 |';
  const text = readableText(source, true);
  expect(text).toContain('Hello world.');
  expect(text).toContain('Hidden prose.');
  expect(text).toContain('Foo. 20.');
  expect(text).not.toMatch(/secret|https|\*\*|<details>/);
});
it('chunks long pages without losing words, including Unicode and unbroken strings', () => {
  const text = ('First sentence. Second sentence!\n\n' + '😀'.repeat(90) + '\n').repeat(80).trim();
  const chunks = speechChunks(text);
  expect(chunks.length).toBeGreaterThan(10);
  expect(chunks.every(c => c.length <= 800)).toBe(true);
  expect(chunks.join('').replace(/\s/g, '')).toBe(text.replace(/\s/g, ''));
  expect(chunks.every(c => !/[\uD800-\uDBFF]$/.test(c))).toBe(true);
  expect(speechChunks(' '.repeat(5))).toEqual([]);
});
