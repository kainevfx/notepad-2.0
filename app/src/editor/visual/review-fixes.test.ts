// @vitest-environment happy-dom
// Regression tests for the final review's findings (Critical 1-2, Important 3).
import { describe, it, expect, afterEach } from 'vitest';
import type { Editor } from '@tiptap/core';
import { mountVisualEditor, loadIntoEditor, editorToMarkdown } from './extensions';

let ed: Editor | null = null;
afterEach(() => {
  ed?.destroy();
  ed = null;
});

function open(md: string, onEdit: () => void = () => {}): Editor {
  ed = mountVisualEditor(document.createElement('div'), onEdit);
  loadIntoEditor(ed, md, true);
  return ed;
}

/** Round-trip after a real edit elsewhere in the document (appends "!" to the first text). */
function afterEdit(md: string): string {
  const e = open(md);
  let pos = -1;
  e.state.doc.descendants((n, p) => {
    if (pos < 0 && n.isText && n.text === 'EDIT') pos = p + n.nodeSize;
  });
  expect(pos).toBeGreaterThan(0);
  e.commands.insertContentAt(pos, '!');
  return editorToMarkdown(e).trim();
}
const survivesEdit = (body: string) => expect(afterEdit(`EDIT\n\n${body}`)).toBe(`EDIT!\n\n${body}`.trim());

describe('Critical 1: undo never reverts a file load', () => {
  it('undo straight after opening a file changes nothing and reports no edit', () => {
    let edits = 0;
    const e = open('# A body', () => edits++);
    e.commands.undo();
    expect(editorToMarkdown(e).trim()).toBe('# A body');
    expect(edits).toBe(0);
  });
  it('undo after switching tabs never brings back the previous tab', () => {
    const e = open('# A body');
    loadIntoEditor(e, '# B other tab', true);
    e.commands.focus('end');
    e.commands.insertContent('Z');
    e.commands.undo();
    e.commands.undo();
    e.commands.undo();
    expect(editorToMarkdown(e).trim()).toBe('# B other tab');
  });
});

describe('Critical 2: images and README HTML survive an edit', () => {
  it('inline image with title', () => survivesEdit('![alt text](img/a.png "Title")'));
  it('badge: image inside a link', () => survivesEdit('[![CI](https://ci/badge.svg)](https://ci)'));
  it('reference image and its definition', () => survivesEdit('![logo][l]\n\n[l]: logo.png'));
  it('reference link and its definition', () => survivesEdit('See [the docs][d].\n\n[d]: https://example.com/docs'));
  it('GitHub README header div', () => survivesEdit('<div align="center">\n  <img src="logo.png">\n</div>'));
  it('aligned div without blank lines', () => survivesEdit('<div align="center">\ntext\n</div>'));
  it('aligned div around a list keeps its wrapper', () => survivesEdit('<div align="center">\n\n- a\n- b\n\n</div>'));
  it('complex aligned heading', () => survivesEdit('<h1 align="center">\n <a href="x"><img src="l.png"></a>\n <br>\n Title\n</h1>'));
});

describe('Important 3: constructs keep their meaning after an edit', () => {
  it('HTML entities', () => survivesEdit('&copy; 2026 &nbsp; &#169; &amp;'));
  it('backslash escapes at line start', () => survivesEdit('\\# not a heading\n\n2026\\. A year\n\n\\- x\n\n\\+ y'));
  it('escaped pipe in a table cell', () => survivesEdit('| A      | B   |\n| ------ | --- |\n| x \\| y | 2   |'));
  it('inline <br> stays inline', () => survivesEdit('a<br>b'));
  it('nested fences keep a longer fence', () => survivesEdit('````md\n```js\nx\n```\n````'));
  it('multi-paragraph footnote', () => survivesEdit('Text[^1].\n\n[^1]: First\n\n    Second'));
  it('span with other styles is kept verbatim', () => survivesEdit('<span style="background:yellow">hi</span>'));
  it("span with single-quoted style is kept verbatim", () => survivesEdit("<span style='color:red'>x</span>"));
  it('nested styled spans', () => survivesEdit('<span style="color:#ff0000"><span style="font-size:18px">x</span></span>'));
  it('angle-bracket link target', () => survivesEdit('[x](<a b.md>)'));
});

describe('locked blocks render in Visual', () => {
  it('block maths renders with KaTeX', () => {
    const e = open('$$\nx^2\n$$');
    expect(e.view.dom.querySelector('.locked-block .katex')).not.toBeNull();
  });
  it('a block that renders to nothing shows its source instead', () => {
    const e = open('Text[^1].\n\n[^1]: The note.');
    expect(e.view.dom.querySelector('.locked-block[data-locked="footnote"]')?.textContent).toContain('[^1]: The note.');
  });
  it('raw HTML renders sanitised', () => {
    const e = open('<details>\n<summary>More</summary>\n\nHidden\n</details>');
    expect(e.view.dom.querySelector('.locked-block details summary')?.textContent).toBe('More');
  });
});
