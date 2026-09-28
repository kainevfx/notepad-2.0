// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import { visualExtensions, parseMarkdownToEditor, editorToMarkdown } from './extensions';

let ed: Editor | null = null;
afterEach(() => {
  ed?.destroy();
  ed = null;
});

function load(md: string): Editor {
  ed = new Editor({ extensions: visualExtensions() });
  parseMarkdownToEditor(ed, md);
  return ed;
}
const rt = (md: string) => editorToMarkdown(load(md));
const same = (md: string) => expect(rt(md).trim()).toBe(md.trim());

describe('visual markdown round-trip', () => {
  it('headings and paragraphs', () => same('# One\n\n## Two\n\nBody text.'));
  it('emphasis', () => same('**b** *i* ~~s~~ `c`'));
  it('bullet, ordered and task lists, nested', () => same('- a\n  - b\n- c\n\n1. x\n2. y\n\n- [ ] todo\n- [x] done'));
  // TipTap pads table cells to at least the '---' width: accepted normalisation (spec trade-off).
  it('table', () => same('| A   | B   |\n| --- | --- |\n| 1   | 2   |'));
  it('table: compact cells are padded, content unchanged', () =>
    expect(rt('| A | B |\n| --- | --- |\n| 1 | 2 |').trim()).toBe('| A   | B   |\n| --- | --- |\n| 1   | 2   |'));
  it('link', () => same('[site](https://example.com)'));
  it('code block with language', () => same('```ts\nconst a = 1;\n```'));
  it('blockquote and rule', () => same('> quoted\n\n---\n\nafter'));
  it('underline as <u>', () => same('a <u>b</u> c'));
  it('colour span', () => same('a <span style="color:#ff0000">red</span> b'));
  it('size + weight merge into one span', () => same('<span style="font-size:18px;font-weight:300">x</span>'));
  it('centred paragraph and right heading', () => same('<p align="center">mid</p>\n\n<h2 align="right">R</h2>'));
  it('front matter is locked and verbatim', () => same('---\ntitle: X\ntags: [a, b]\n---\n\n# Doc'));
  it('block and inline maths verbatim', () => same('$$\n\\int_0^1 x\\,dx\n$$\n\nInline $a^2$ here.'));
  it('dollar amounts stay plain text', () => {
    same('It costs $5 and $10 today.');
    expect(JSON.stringify(load('It costs $5 and $10 today.').getJSON())).not.toContain('lockedInline');
  });
  it('mermaid verbatim', () => same('```mermaid\ngraph TD\n  A-->B\n```'));
  it('footnotes verbatim', () => same('Text[^1].\n\n[^1]: The note.'));
  it('other raw HTML verbatim', () => same('<details>\n<summary>More</summary>\n\nHidden\n</details>'));
  it('html comment verbatim', () => same('<!-- keep me -->\n\ntext'));
  it('unknown inline HTML verbatim', () => same('Press <kbd>Ctrl</kbd> and <br> <sup>2</sup> now'));
  it('text after a raw HTML block still parses', () => {
    const md = '<div>\nraw\n</div>\n\n**bold** after';
    same(md);
    expect(JSON.stringify(load(md).getJSON())).toContain('"type":"bold"');
  });
});

describe('parsing into the right nodes', () => {
  it('underline becomes an underline mark', () => {
    const json = load('<u>b</u>').getJSON();
    expect(JSON.stringify(json)).toContain('"type":"underline"');
  });
  it('colour becomes a textStyle mark with color', () => {
    const json = JSON.stringify(load('<span style="color:#ff0000">r</span>').getJSON());
    expect(json).toContain('"color":"#ff0000"');
  });
  it('front matter is a locked block', () => {
    const json = JSON.stringify(load('---\na: 1\n---\n\nx').getJSON());
    expect(json).toContain('"type":"lockedBlock"');
  });
  it('a later --- rule is not front matter', () => {
    const json = JSON.stringify(load('x\n\n---\n\ny').getJSON());
    expect(json).toContain('"type":"horizontalRule"');
    expect(json).not.toContain('lockedBlock');
  });
});

describe('editing formatting in visual', () => {
  it('applying colour writes a span', () => {
    const e = load('hello');
    e.commands.selectAll();
    e.commands.setColor('#00ff00');
    expect(editorToMarkdown(e).trim()).toBe('<span style="color:#00ff00">hello</span>');
  });
  it('centring a paragraph writes align', () => {
    const e = load('hello');
    e.commands.setTextAlign('center');
    expect(editorToMarkdown(e).trim()).toBe('<p align="center">hello</p>');
  });
});

describe('kitchen sink survives an unrelated edit', () => {
  it('only the edited line changes', () => {
    const md =
      '---\na: 1\n---\n\n# T\n\nPara one.\n\n```mermaid\ngraph TD\n  A-->B\n```\n\n| A   | B   |\n| --- | --- |\n| 1   | 2   |\n\nNote[^n].\n\n[^n]: Foot.\n\n<details>\n<summary>S</summary>\n\nX\n</details>';
    const e = load(md);
    let pos = -1;
    e.state.doc.descendants((n, p) => {
      if (n.isText && n.text === 'Para one.') pos = p + n.nodeSize;
    });
    expect(pos).toBeGreaterThan(0);
    e.commands.insertContentAt(pos, ' Edited');
    expect(editorToMarkdown(e).trim()).toBe(md.replace('Para one.', 'Para one. Edited').trim());
  });
});

import { mountVisualEditor, loadIntoEditor } from './extensions';

describe('only real edits count as edits', () => {
  it('loading text and toggling editable never reports an edit', () => {
    let edits = 0;
    const el = document.createElement('div');
    ed = mountVisualEditor(el, () => edits++);
    loadIntoEditor(ed, '* a\n\n__b__', true);
    loadIntoEditor(ed, '# other', false);
    loadIntoEditor(ed, '# other', true);
    expect(edits).toBe(0);
  });
  it('typing reports an edit', () => {
    let edits = 0;
    ed = mountVisualEditor(document.createElement('div'), () => edits++);
    loadIntoEditor(ed, 'x', true);
    ed.commands.insertContent('y');
    expect(edits).toBe(1);
  });
});
