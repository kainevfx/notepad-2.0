// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import type { Editor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { mountVisualEditor, loadIntoEditor, editorToMarkdown } from './extensions';
import { tableAt, setColumnWidths, fitRowsToData, fitTableToPage } from './table-fit';
import { pickWide } from '../../lib/float-hscroll';

let ed: Editor | null = null;
afterEach(() => {
  ed?.destroy();
  ed = null;
});
function open(md: string): Editor {
  ed = mountVisualEditor(document.createElement('div'), () => {});
  loadIntoEditor(ed, md, true);
  // Put the cursor in the first cell.
  let at = -1;
  ed.state.doc.descendants((n, p) => {
    if (at < 0 && n.type.name === 'paragraph' && n.textContent === 'A') at = p + 1;
  });
  ed.view.dispatch(ed.state.tr.setSelection(TextSelection.create(ed.state.doc, at)));
  return ed;
}
const out = (e: Editor) => editorToMarkdown(e).trim();
const GFM = '| A   | B   | C   |\n| --- | --- | --- |\n| 1   | 2   | 3   |';

describe('table fit tools', () => {
  it('finds the table the cursor is in', () => {
    const e = open(GFM);
    expect(tableAt(e.state)?.node.type.name).toBe('table');
  });

  it('setting column widths writes them to every cell of the column (one undo step)', () => {
    const e = open(GFM);
    const t = tableAt(e.state)!;
    e.view.dispatch(setColumnWidths(e.state, t.pos, [120, null, 300]));
    const md = out(e);
    expect(md).toContain('<colgroup><col style="width:120px"><col><col style="width:300px"></colgroup>');
    e.commands.undo();
    expect(out(e)).toBe(GFM);
  });

  it('fit to page width clears the widths, so a simple table is Markdown again', () => {
    const e = open(GFM);
    const t = tableAt(e.state)!;
    e.view.dispatch(setColumnWidths(e.state, t.pos, [120, 200, 300]));
    expect(out(e)).toContain('<table>');
    expect(fitTableToPage(e)).toBe(true);
    expect(out(e)).toBe(GFM);
  });

  it('fit rows to data height clears dragged row heights', () => {
    const e = open(GFM);
    const t = tableAt(e.state)!;
    const row = t.node.child(1);
    const rowPos = t.pos + 1 + t.node.child(0).nodeSize;
    e.view.dispatch(e.state.tr.setNodeMarkup(rowPos, undefined, { ...row.attrs, rowHeight: 90 }));
    expect(out(e)).toContain('height:90px');
    expect(fitRowsToData(e)).toBe(true);
    expect(out(e)).toBe(GFM);
  });

  it('nothing to clear is not an edit', () => {
    const e = open(GFM);
    expect(fitRowsToData(e)).toBe(false);
    expect(fitTableToPage(e)).toBe(false);
  });
});

describe('floating sideways scrollbar', () => {
  const view = { top: 0, bottom: 600 };
  it('drives a wide table that is on screen and runs past the bottom', () => {
    expect(pickWide(view, [{ top: 100, bottom: 2000, wide: true }])).toBe(0);
  });
  it('not when the table is narrow, its own scrollbar is visible, or it is below the view', () => {
    expect(pickWide(view, [{ top: 100, bottom: 2000, wide: false }])).toBe(-1);
    expect(pickWide(view, [{ top: 100, bottom: 500, wide: true }])).toBe(-1);
    expect(pickWide(view, [{ top: 590, bottom: 2000, wide: true }])).toBe(-1);
  });
});
