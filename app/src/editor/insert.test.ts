import { describe, it, expect } from 'vitest';
import { insertSnippet, imageMarkdown, isAbsolutePath } from './insert';

describe('insertSnippet', () => {
  it('page break: an HTML marker in Markdown, a form feed in plain text', () => {
    expect(insertSnippet('pageBreak', true)).toBe('\n\n<div class="page-break"></div>\n\n');
    expect(insertSnippet('pageBreak', false)).toBe('\f');
  });
  it('line break: <br> in Markdown, a newline in plain text', () => {
    expect(insertSnippet('lineBreak', true)).toBe('<br>\n');
    expect(insertSnippet('lineBreak', false)).toBe('\n');
  });
});

describe('imageMarkdown', () => {
  it('same folder', () => expect(imageMarkdown('C:\\d\\a.md', 'C:\\d\\img.png')).toBe('![img](img.png)'));
  it('subfolder, spaces encoded', () => expect(imageMarkdown('C:\\d\\a.md', 'C:\\d\\assets\\x y.png')).toBe('![x y](assets/x%20y.png)'));
  it('parent folder', () => expect(imageMarkdown('C:\\d\\sub\\a.md', 'C:\\d\\img.png')).toBe('![img](../img.png)'));
  it('drive letters compare case-insensitively', () => expect(imageMarkdown('c:\\d\\a.md', 'C:\\D\\img.png')).toBe('![img](img.png)'));
  it('another drive stays absolute', () => expect(imageMarkdown('C:\\d\\a.md', 'D:\\p\\img.png')).toBe('![img](D:/p/img.png)'));
  it('unsaved notes use the absolute path', () => expect(imageMarkdown(null, 'C:\\p\\my pic.jpg')).toBe('![my pic](C:/p/my%20pic.jpg)'));
});

describe('isAbsolutePath', () => {
  it('recognises drive paths only', () => {
    expect(isAbsolutePath('D:/p/img.png')).toBe(true);
    expect(isAbsolutePath('assets/x.png')).toBe(false);
    expect(isAbsolutePath('https://x/y.png')).toBe(false);
  });
});
