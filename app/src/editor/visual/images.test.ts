// @vitest-environment happy-dom
import { afterEach, expect, it } from 'vitest';
import type { Editor } from '@tiptap/core';
import { createRenderContext } from './render-context';
import { mountVisualEditor, loadIntoEditor, editorToMarkdown } from './extensions';
import { resolveImageUrl } from '../insert';
import { renderMarkdown } from '../../markdown/pipeline';

let editor: Editor | undefined;
afterEach(() => editor?.destroy());
it('renders Markdown and HTML images with the document folder, without changing source', () => {
  let folder = 'E:/[WIP]/My documents';
  let block = false;
  let edits = 0;
  const context = createRenderContext(() => ({
    resolveUrl: u => resolveImageUrl(folder, u, p => 'http://asset.localhost/' + encodeURIComponent(p)),
    blockRemoteImages: block,
  }));
  editor = mountVisualEditor(document.createElement('div'), () => edits++, context);
  const source = 'EDIT\n\n![Photo](images/a%20b.png)\n\n<figure><img src="images/c.png" width="220"></figure>\n\n![Remote](https://example.com/a.png)';
  loadIntoEditor(editor, source, true);
  const images = () => Array.from(editor!.view.dom.querySelectorAll('img:not(.ProseMirror-separator)'));
  expect(images()).toHaveLength(3);
  expect(images()[0].src).toContain(encodeURIComponent('E:\\[WIP]\\My documents\\images\\a b.png'));
  expect(images()[1].getAttribute('width')).toBe('220');
  folder = 'C:/Other';
  block = true;
  context.refresh();
  expect(images()[0].src).toContain(encodeURIComponent('C:\\Other\\images\\a b.png'));
  expect(images()[2].getAttribute('src')).toBe('');
  expect(edits).toBe(0);
  editor.commands.insertContentAt(5, '!');
  expect(editorToMarkdown(editor).trim()).toBe(source.replace('EDIT', 'EDIT!'));
});

it('Split retains embedded data and resolves file URI images before sanitization', () => {
  const opts = { resolveUrl: (u: string) => resolveImageUrl('E:/[WIP]/Docs', u, p => 'http://asset.localhost/' + encodeURIComponent(p)) };
  const html = renderMarkdown('![A](file:///C:/My%20Images/a.png)\n\n<img src="data:image/png;base64,AAAA">', opts);
  expect(html).toContain('http://asset.localhost/C%3A%5CMy%20Images%5Ca.png');
  expect(html).toContain('data:image/png;base64,AAAA');
  expect(renderMarkdown('![A](x.png)', { resolveUrl: () => 'https://first.example/x' })).toContain('first.example');
  expect(renderMarkdown('![A](x.png)', { resolveUrl: () => 'https://second.example/x' })).toContain('second.example');
});
