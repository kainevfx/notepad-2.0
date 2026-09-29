// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import type { Editor } from '@tiptap/core';
import { mountVisualEditor, loadIntoEditor, editorToMarkdown } from './extensions';

let ed: Editor | null = null;
afterEach(() => {
  ed?.destroy();
  ed = null;
});
function open(md: string): Editor {
  ed = mountVisualEditor(document.createElement('div'), () => {});
  loadIntoEditor(ed, md, true);
  return ed;
}
const out = (e: Editor) => editorToMarkdown(e).trim();

/** Find the position of the first node of a type. */
function posOf(e: Editor, type: string): number {
  let at = -1;
  e.state.doc.descendants((n, p) => {
    if (at < 0 && n.type.name === type) at = p;
  });
  return at;
}
function setAttrs(e: Editor, type: string, attrs: Record<string, unknown>) {
  const p = posOf(e, type);
  const node = e.state.doc.nodeAt(p)!;
  e.view.dispatch(e.state.tr.setNodeMarkup(p, undefined, { ...node.attrs, ...attrs }));
}

const GFM = '| A   | B   |\n| --- | --- |\n| 1   | 2   |';

describe('tables: when to write Markdown vs HTML', () => {
  it('a simple table stays a Markdown table', () => {
    expect(out(open(GFM))).toBe(GFM);
  });
  it('bold and colour in cells stay a Markdown table', () => {
    const md = '| **A** | <span style="color:#d93025">B</span> |\n| ----- | --------------------------------------- |\n| 1     | 2                                       |';
    const res = out(open(md));
    expect(res).not.toContain('<table');
    expect(res).toContain('**A**');
    expect(res).toContain('<span style="color:#d93025">B</span>');
  });
  it('a resized column switches to an HTML table with a width', () => {
    const e = open(GFM);
    setAttrs(e, 'tableHeader', { colwidth: [120] });
    const res = out(e);
    expect(res.startsWith('<table>')).toBe(true);
    expect(res).toContain('<col style="width:120px">');
  });
  it('a resized row writes its height', () => {
    const e = open(GFM);
    setAttrs(e, 'tableRow', { rowHeight: 40 });
    expect(out(e)).toContain('<tr style="height:40px">');
  });
  it('a heading inside a cell switches to an HTML table and keeps the heading', () => {
    const e = open(GFM);
    const p = posOf(e, 'tableCell');
    e.commands.setTextSelection(p + 2);
    e.commands.setNode('heading', { level: 2 });
    const res = out(e);
    expect(res).toContain('<table>');
    expect(res).toContain('## 1');
  });
});

describe('tables: empty cells', () => {
  it('an empty cell in an HTML table is written compactly', () => {
    const e = open('| A   | B   |\n| --- | --- |\n| 1   |     |');
    setAttrs(e, 'tableRow', { rowHeight: 30 });
    expect(out(e)).toContain('</td><td></td></tr>');
  });
});

describe('tables: HTML tables load back as editable tables', () => {
  const html = [
    '<table>',
    '<colgroup><col style="width:120px"><col></colgroup>',
    '<tr><th>',
    '',
    'Name',
    '',
    '</th><th>',
    '',
    'Notes',
    '',
    '</th></tr>',
    '<tr style="height:40px"><td>',
    '',
    '## Big',
    '',
    '</td><td>',
    '',
    '- one',
    '- two',
    '',
    '</td></tr>',
    '</table>',
  ].join('\n');

  it('round-trips exactly', () => expect(out(open(html))).toBe(html));
  it('is a real table with widths, heights and block content', () => {
    const json = JSON.stringify(open(html).getJSON());
    expect(json).toContain('"type":"table"');
    expect(json).toContain('"colwidth":[120]');
    expect(json).toContain('"rowHeight":40');
    expect(json).toContain('"type":"heading"');
    expect(json).toContain('"type":"bulletList"');
    expect(json).not.toContain('lockedBlock');
  });
  it('other people’s HTML tables stay locked, verbatim', () => {
    const foreign = '<table class="x">\n<tr><td>a</td></tr>\n</table>';
    const e = open(foreign);
    expect(JSON.stringify(e.getJSON())).toContain('lockedBlock');
    expect(out(e)).toBe(foreign);
  });
});
