// Spreadsheet-style tables for the Visual view.
//
// - Cells hold any content: formatted text, headings, lists, several paragraphs.
// - Columns resize by dragging their border; rows by dragging their bottom border.
// - Saved as a Markdown (GFM) table while simple. Once a table has a resized column or row, or a
//   cell holds more than one plain paragraph, it is saved as an HTML table with Markdown inside
//   the cells (GitHub and the preview render both):
//
//     <table>
//     <colgroup><col style="width:120px"><col></colgroup>
//     <tr style="height:40px"><th>
//
//     **Name**
//
//     </th>…</tr>
//     </table>
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { Table, TableRow, TableHeader, TableCell, renderTableToMarkdown } from '@tiptap/extension-table';

// ---------------------------------------------------------------- writing

/**
 * The starting grid column of every cell, allowing for cells merged across rows (rowspan) and
 * columns (colspan). Shared by the writer and the reader so column widths never shift.
 */
export function cellColumns(rows: { colspan: number; rowspan: number }[][]): number[][] {
  const carry: number[] = []; // per column: how many more rows are covered from above
  return rows.map((cells) => {
    const starts: number[] = [];
    let col = 0;
    for (const c of cells) {
      while ((carry[col] ?? 0) > 0) col++;
      starts.push(col);
      for (let k = 0; k < c.colspan; k++) carry[col + k] = c.rowspan;
      col += c.colspan;
    }
    for (let i = 0; i < carry.length; i++) if (carry[i] > 0) carry[i]--;
    return starts;
  });
}

const spans = (cell: any) => ({ colspan: cell.attrs?.colspan ?? 1, rowspan: cell.attrs?.rowspan ?? 1 });

function isSimple(table: any): boolean {
  const rows = table.content ?? [];
  // Markdown tables always have exactly one header row, the first one.
  if (!rows.length || !(rows[0].content ?? []).every((c: any) => c.type === 'tableHeader')) return false;
  for (const [ri, row] of rows.entries()) {
    if (row.attrs?.rowHeight) return false;
    for (const cell of row.content ?? []) {
      if (ri > 0 && cell.type === 'tableHeader') return false;
      if (cell.attrs?.colwidth?.some((w: number) => w)) return false;
      if ((cell.attrs?.colspan ?? 1) > 1 || (cell.attrs?.rowspan ?? 1) > 1) return false;
      const blocks = cell.content ?? [];
      if (blocks.length > 1 || (blocks[0] && blocks[0].type !== 'paragraph')) return false;
      if (blocks[0]?.content?.some((n: any) => n.type === 'hardBreak')) return false;
    }
  }
  return true;
}

function renderHtmlTable(table: any, h: any): string {
  const rows = table.content ?? [];
  const starts = cellColumns(rows.map((r: any) => (r.content ?? []).map(spans)));
  const widths: (number | null)[] = [];
  let cols = 0;
  rows.forEach((row: any, ri: number) => {
    (row.content ?? []).forEach((cell: any, ci: number) => {
      const { colspan } = spans(cell);
      const at = starts[ri][ci];
      cols = Math.max(cols, at + colspan);
      for (let k = 0; k < colspan; k++) {
        const w = cell.attrs?.colwidth?.[k];
        if (w && widths[at + k] == null) widths[at + k] = w;
      }
    });
  });
  const lines = ['<table>'];
  if (widths.some((w) => w)) {
    lines.push(`<colgroup>${Array.from({ length: cols }, (_, i) => (widths[i] ? `<col style="width:${widths[i]}px">` : '<col>')).join('')}</colgroup>`);
  }
  for (const row of rows) {
    const height = row.attrs?.rowHeight;
    let line = height ? `<tr style="height:${height}px">` : '<tr>';
    for (const cell of row.content ?? []) {
      const tag = cell.type === 'tableHeader' ? 'th' : 'td';
      const span = [(cell.attrs?.colspan ?? 1) > 1 ? ` colspan="${cell.attrs.colspan}"` : '', (cell.attrs?.rowspan ?? 1) > 1 ? ` rowspan="${cell.attrs.rowspan}"` : ''].join('');
      const body = (cell.content ?? []).map((b: any) => h.renderChildren([b]).trim()).filter(Boolean).join('\n\n');
      line += body ? `<${tag}${span}>\n\n${body}\n\n</${tag}>` : `<${tag}${span}></${tag}>`;
    }
    lines.push(line + '</tr>');
  }
  lines.push('</table>');
  return lines.join('\n');
}

// ---------------------------------------------------------------- reading our HTML tables

const CELL = /<(th|td)((?: (?:colspan|rowspan)="\d+")*)>([\s\S]*?)<\/\1>/g;

/** Parse an HTML table in exactly the form written above; anything else stays locked (raw). */
export function ownHtmlTable(src: string): { raw: string; widths: (number | null)[]; rows: { height: number | null; cells: { header: boolean; colspan: number; rowspan: number; inner: string }[] }[] } | null {
  const m = /^<table>\n([\s\S]*?)\n<\/table>[ \t]*(?:\n+|$)/.exec(src);
  if (!m || m[1].includes('<table')) return null;
  const lines = m[1].split('\n');
  let widths: (number | null)[] = [];
  const colgroup = /^<colgroup>((?:<col(?: style="width:\d+px")?>)*)<\/colgroup>$/.exec(lines[0] ?? '');
  let body = m[1];
  if (colgroup) {
    widths = [...colgroup[1].matchAll(/<col(?: style="width:(\d+)px")?>/g)].map((c) => (c[1] ? Number(c[1]) : null));
    body = lines.slice(1).join('\n');
  }
  const rows: { height: number | null; cells: { header: boolean; colspan: number; rowspan: number; inner: string }[] }[] = [];
  const rowRe = /<tr(?: style="height:(\d+)px")?>([\s\S]*?)<\/tr>/g;
  let last = 0;
  for (let r = rowRe.exec(body); r; r = rowRe.exec(body)) {
    if (body.slice(last, r.index).trim()) return null; // stray content between rows
    last = r.index + r[0].length;
    const cells: { header: boolean; colspan: number; rowspan: number; inner: string }[] = [];
    let cellLast = 0;
    CELL.lastIndex = 0;
    for (let c = CELL.exec(r[2]); c; c = CELL.exec(r[2])) {
      if (r[2].slice(cellLast, c.index).trim()) return null;
      cellLast = c.index + c[0].length;
      const span = (k: string) => Number(new RegExp(`${k}="(\\d+)"`).exec(c![2])?.[1] ?? 1);
      cells.push({ header: c[1] === 'th', colspan: span('colspan'), rowspan: span('rowspan'), inner: c[3].replace(/^\s*\n/, '').replace(/\n\s*$/, '').trim() });
    }
    if (r[2].slice(cellLast).trim() || !cells.length) return null;
    rows.push({ height: r[1] ? Number(r[1]) : null, cells });
  }
  if (!rows.length || body.slice(last).trim()) return null;
  return { raw: m[0], widths, rows };
}

const HtmlTableMarkdown = Extension.create({
  name: 'htmlTable',
  markdownTokenizer: {
    name: 'htmlTable',
    level: 'block',
    start: (src: string) => {
      const i = src.indexOf('\n<table>');
      return i < 0 ? -1 : i + 1;
    },
    tokenize: (src: string, _tokens: unknown, lexer: any) => {
      const t = ownHtmlTable(src);
      if (!t) return undefined;
      return {
        type: 'htmlTable',
        raw: t.raw,
        widths: t.widths,
        rows: t.rows.map((r) => ({ ...r, cells: r.cells.map((c) => ({ ...c, tokens: lexer.blockTokens(c.inner) })) })),
      };
    },
  },
  parseMarkdown: (token: any, h: any) => {
    const starts = cellColumns(token.rows.map((r: any) => r.cells));
    const rows = token.rows.map((r: any, ri: number) =>
      h.createNode(
        'tableRow',
        { rowHeight: r.height },
        r.cells.map((c: any, ci: number) => {
          const w = token.widths.slice(starts[ri][ci], starts[ri][ci] + c.colspan);
          const colwidth = w.some((x: number | null) => x) ? Array.from({ length: c.colspan }, (_, k) => w[k] ?? 0) : null;
          const content = h.parseChildren(c.tokens);
          return h.createNode(c.header ? 'tableHeader' : 'tableCell', { colspan: c.colspan, rowspan: c.rowspan, colwidth }, content.length ? content : [h.createNode('paragraph', undefined, [])]);
        }),
      ),
    );
    return h.createNode('table', undefined, rows);
  },
} as any);

// ---------------------------------------------------------------- nodes

export const SheetTable = Table.extend({
  renderMarkdown: (node: any, h: any) => {
    if (!isSimple(node)) return renderHtmlTable(node, h);
    // GFM: cell text comes back from the parser with \| unescaped, so escape pipes again; and the
    // stock renderer pads the table with blank lines the block separator already adds.
    const cells = { ...h, renderChildren: (n: any, sep?: any) => h.renderChildren(n, sep).replace(/(?<!\\)\|/g, '\\|') };
    return renderTableToMarkdown(node, cells).replace(/^\n+|\n+$/g, '');
  },
} as any).configure({ resizable: true, cellMinWidth: 48, lastColumnResizable: true });

export const SheetRow = TableRow.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      rowHeight: {
        default: null,
        parseHTML: (el: HTMLElement) => parseInt(el.style.height, 10) || null,
        renderHTML: (a: Record<string, any>) => (a.rowHeight ? { style: `height:${a.rowHeight}px` } : {}),
      },
    };
  },
});

// ---------------------------------------------------------------- row resizing

const rowResizeKey = new PluginKey('np2RowResize');
const EDGE = 5; // px from a row's bottom border that starts a resize

/** The row whose bottom border is under the pointer (the border also counts as the top of the next row). */
function rowAt(e: MouseEvent): HTMLTableRowElement | null {
  const tr = (e.target as HTMLElement).closest?.('tr') as HTMLTableRowElement | null;
  if (!tr) return null;
  const r = tr.getBoundingClientRect();
  if (e.clientY >= r.bottom - EDGE && e.clientY <= r.bottom + 1) return tr;
  const prev = tr.previousElementSibling as HTMLTableRowElement | null;
  return prev && e.clientY <= r.top + 2 ? prev : null;
}

function startRowDrag(view: EditorView, tr: HTMLTableRowElement, e: MouseEvent) {
  const pos = view.posAtDOM(tr, 0);
  const $pos = view.state.doc.resolve(pos);
  let rowPos = -1;
  for (let d = $pos.depth; d > 0; d--) {
    if ($pos.node(d).type.name === 'tableRow') {
      rowPos = $pos.before(d);
      break;
    }
  }
  if (rowPos < 0) return;
  const rect = tr.getBoundingClientRect();
  const scale = tr.offsetHeight ? rect.height / tr.offsetHeight : 1; // CSS zoom (interface size)
  const startY = e.clientY;
  const startH = tr.offsetHeight;
  let h = startH;
  const move = (ev: MouseEvent) => {
    h = Math.max(24, Math.round(startH + (ev.clientY - startY) / scale));
    tr.style.height = `${h}px`;
  };
  const up = () => {
    window.removeEventListener('mousemove', move);
    window.removeEventListener('mouseup', up);
    view.dom.classList.remove('row-resizing');
    const node = view.state.doc.nodeAt(rowPos);
    if (node && h !== startH) view.dispatch(view.state.tr.setNodeMarkup(rowPos, undefined, { ...node.attrs, rowHeight: h }));
  };
  view.dom.classList.add('row-resizing');
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
}

export const RowResize = Extension.create({
  name: 'rowResize',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: rowResizeKey,
        props: {
          handleDOMEvents: {
            mousemove: (view, e) => {
              if (!view.editable) return false;
              view.dom.classList.toggle('row-resize-cursor', !!rowAt(e as MouseEvent));
              return false;
            },
            mousedown: (view, e) => {
              const tr = view.editable ? rowAt(e as MouseEvent) : null;
              if (!tr) return false;
              e.preventDefault();
              startRowDrag(view, tr, e as MouseEvent);
              return true;
            },
          },
        },
      }),
    ];
  },
});

export const tableExtensions = [HtmlTableMarkdown, SheetTable, SheetRow, TableHeader, TableCell, RowResize];
