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

import { resolveImageUrl } from './insert';

describe('review fixes: image paths', () => {
  it('only characters that break a link are escaped', () =>
    expect(imageMarkdown('C:\\d\\a.md', 'C:\\d\\a&b, #1 (x).png')).toBe('![a&b, #1 (x)](a&b,%20%231%20%28x%29.png)'));
  it('an unbalanced ) cannot end the link early', () => expect(imageMarkdown('C:\\d\\a.md', 'C:\\d\\a).png')).toBe('![a)](a%29.png)'));

  const asset = (p: string) => `asset://${p}`;
  it('relative paths resolve against the document folder and decode fully', () =>
    expect(resolveImageUrl('C:\\d', 'a&b,%20%231%20%28x%29.png', asset)).toBe('asset://C:\\d\\a&b, #1 (x).png'));
  it('parent folders resolve', () => expect(resolveImageUrl('C:\\d\\sub', '../img.png', asset)).toBe('asset://C:\\d\\img.png'));
  it('absolute drive paths load directly, even in unsaved notes', () => {
    expect(resolveImageUrl(null, 'C:/p/my%20pic.jpg', asset)).toBe('asset://C:\\p\\my pic.jpg');
    expect(resolveImageUrl('C:\\d', 'D:/p/x.png', asset)).toBe('asset://D:\\p\\x.png');
  });
  it('web and data URLs are left alone; broken escapes do not throw', () => {
    expect(resolveImageUrl('C:\\d', 'https://x/y.png', asset)).toBe('https://x/y.png');
    expect(resolveImageUrl('C:\\d', 'data:image/png;base64,AA', asset)).toBe('data:image/png;base64,AA');
    expect(resolveImageUrl('C:\\d', 'bad%zz.png', asset)).toBe('asset://C:\\d\\bad%zz.png');
  });
});
