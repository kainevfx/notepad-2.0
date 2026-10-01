// Table menu "fit" tools for the Visual view (the table the cursor is in):
//
// - Fit columns to data width: each column becomes as wide as its longest entry (up to FIT_MAX,
//   so a cell holding a paragraph still wraps), so rows shrink to one line. Wider than the page
//   is fine: the table scrolls sideways.
// - Fit rows to data height: forget dragged row heights, so every row is as tall as its content.
// - Fit table to page width: forget column widths, so the columns share the page again.
//
// Each is one undo step. Column widths are saved like a dragged column (the table is written as an
// HTML table, see tables.ts); clearing them all lets a simple table go back to a Markdown table.
import type { Editor } from '@tiptap/core';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';
import { TableMap } from '@tiptap/pm/tables';

export const FIT_MIN = 48; // matches the table's cellMinWidth
export const FIT_MAX = 560;

/** The table the selection is in, and its position. */
export function tableAt(state: EditorState): { node: PMNode; pos: number } | null {
  const $from = state.selection.$from;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === 'table') return { node, pos: $from.before(d) };
  }
  return null;
}

/** Each distinct cell once, with its position inside the table and its first/last grid column. */
function cells(table: PMNode): { rel: number; node: PMNode; left: number; right: number }[] {
  const map = TableMap.get(table);
  const seen = new Set<number>();
  const out: { rel: number; node: PMNode; left: number; right: number }[] = [];
  for (const rel of map.map) {
    if (seen.has(rel)) continue;
    seen.add(rel);
    const rect = map.findCell(rel);
    out.push({ rel, node: table.nodeAt(rel)!, left: rect.left, right: rect.right });
  }
  return out;
}

/** Give each grid column the width in `widths` (null leaves that column as it is). */
export function setColumnWidths(state: EditorState, tablePos: number, widths: (number | null)[]): Transaction {
  const table = state.doc.nodeAt(tablePos)!;
  const tr = state.tr;
  for (const c of cells(table)) {
    const cur: number[] = c.node.attrs.colwidth ?? [];
    const cw = Array.from({ length: c.right - c.left }, (_, k) => widths[c.left + k] ?? cur[k] ?? 0);
    tr.setNodeMarkup(tablePos + 1 + c.rel, undefined, { ...c.node.attrs, colwidth: cw.some((w) => w) ? cw : null });
  }
  return tr;
}

export function clearColumnWidths(state: EditorState, tablePos: number): Transaction {
  const table = state.doc.nodeAt(tablePos)!;
  const tr = state.tr;
  for (const c of cells(table)) {
    if (c.node.attrs.colwidth) tr.setNodeMarkup(tablePos + 1 + c.rel, undefined, { ...c.node.attrs, colwidth: null });
  }
  return tr;
}

export function clearRowHeights(state: EditorState, tablePos: number): Transaction {
  const table = state.doc.nodeAt(tablePos)!;
  const tr = state.tr;
  table.forEach((row, offset) => {
    if (row.attrs.rowHeight) tr.setNodeMarkup(tablePos + 1 + offset, undefined, { ...row.attrs, rowHeight: null });
  });
  return tr;
}

/** Width a cell needs to show its content on one line (layout px), or null if it has none. */
function contentWidth(cell: HTMLElement, scale: number): number | null {
  const box = cell.getBoundingClientRect();
  const cs = getComputedStyle(cell);
  let right = -Infinity;
  const range = document.createRange();
  const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent?.trim()) continue;
    range.selectNodeContents(n);
    for (const r of Array.from(range.getClientRects())) right = Math.max(right, r.right);
  }
  for (const el of Array.from(cell.querySelectorAll('img, svg, .locked-inline, input'))) {
    right = Math.max(right, el.getBoundingClientRect().right);
  }
  if (right === -Infinity) return null;
  const end = (parseFloat(cs.paddingRight) || 0) + (parseFloat(cs.borderRightWidth) || 0);
  return (right - box.left) / scale + end + 2;
}

/** Measure what every column of the table at `tablePos` needs, clamped to FIT_MIN..FIT_MAX. */
export function measureColumns(view: EditorView, tablePos: number): (number | null)[] {
  const table = view.state.doc.nodeAt(tablePos)!;
  const map = TableMap.get(table);
  const widths: (number | null)[] = Array(map.width).fill(null);
  const root = view.dom as HTMLElement;
  root.classList.add('np2-measure'); // no wrapping while measuring (removed before the next paint)
  try {
    const wrap = view.nodeDOM(tablePos) as HTMLElement | null;
    const el = (wrap?.querySelector?.('table') as HTMLElement | null) ?? wrap;
    const scale = el && el.offsetWidth ? el.getBoundingClientRect().width / el.offsetWidth : 1;
    for (const c of cells(table)) {
      const dom = view.nodeDOM(tablePos + 1 + c.rel) as HTMLElement | null;
      if (!dom || c.right - c.left !== 1) continue; // merged cells don't set a column's width
      const w = contentWidth(dom, scale || 1);
      widths[c.left] = Math.max(widths[c.left] ?? FIT_MIN, w ?? FIT_MIN);
    }
  } finally {
    root.classList.remove('np2-measure');
  }
  return widths.map((w) => (w == null ? null : Math.min(FIT_MAX, Math.max(FIT_MIN, Math.ceil(w)))));
}

function run(editor: Editor, make: (state: EditorState, pos: number) => Transaction | null): boolean {
  const t = tableAt(editor.state);
  if (!t) return false;
  const tr = make(editor.state, t.pos);
  if (!tr || !tr.docChanged) return false;
  editor.view.dispatch(tr);
  editor.commands.focus();
  return true;
}

export const fitColumnsToData = (editor: Editor) =>
  run(editor, (state, pos) => setColumnWidths(state, pos, measureColumns(editor.view, pos)));
export const fitRowsToData = (editor: Editor) => run(editor, clearRowHeights);
export const fitTableToPage = (editor: Editor) => run(editor, clearColumnWidths);
